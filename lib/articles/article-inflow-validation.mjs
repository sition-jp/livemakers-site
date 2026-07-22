import { createHash } from "node:crypto";

import { compileSync } from "@mdx-js/mdx";
import { z } from "zod";

export const ARTICLE_INFLOW_SCHEMA_VERSION = "livemakers_article_inflow_feed_v0";
const ARTICLE_FAMILIES = [
  "daily-intel",
  "signal",
  "deep-dive",
  "future-map",
  "mkt12-morning",
  "mkt12-weekend",
  "event-risk-radar",
  "weekly-brief",
  "session",
];
const CHECKSUM = /^[0-9a-f]{64}$/;
const RESERVED_SLUGS = new Set(["today", "series", "archive"]);

export function calculateArticleBodyChecksum(body) {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

class UnsafeArticleInflowBodyError extends Error {}

function visitAst(node, visitor) {
  visitor(node);
  for (const child of node.children ?? []) visitAst(child, visitor);
}

function isAstNode(value) {
  return typeof value === "object" && value !== null && typeof value.type === "string";
}

function isPassiveEstree(node) {
  if (!isAstNode(node)) return false;
  switch (node.type) {
    case "Program":
      return Array.isArray(node.body) && node.body.every(isPassiveEstree);
    case "ExpressionStatement":
      return isPassiveEstree(node.expression);
    case "Identifier":
    case "Literal":
    case "TemplateElement":
      return true;
    case "BinaryExpression":
    case "LogicalExpression":
      return isPassiveEstree(node.left) && isPassiveEstree(node.right);
    case "UnaryExpression":
      return node.operator !== "delete" && isPassiveEstree(node.argument);
    case "ConditionalExpression":
      return isPassiveEstree(node.test)
        && isPassiveEstree(node.consequent)
        && isPassiveEstree(node.alternate);
    case "SequenceExpression":
      return Array.isArray(node.expressions) && node.expressions.every(isPassiveEstree);
    case "TemplateLiteral":
      return Array.isArray(node.quasis)
        && node.quasis.every(isPassiveEstree)
        && Array.isArray(node.expressions)
        && node.expressions.every(isPassiveEstree);
    case "ArrayExpression":
      return Array.isArray(node.elements)
        && node.elements.every((element) => element === null || isPassiveEstree(element));
    case "ObjectExpression":
      return Array.isArray(node.properties) && node.properties.every(isPassiveEstree);
    case "Property":
      return node.kind === "init"
        && node.method !== true
        && isPassiveEstree(node.key)
        && isPassiveEstree(node.value);
    case "ParenthesizedExpression":
      return isPassiveEstree(node.expression);
    default:
      return false;
  }
}

function rejectRawHtml() {
  return (tree) => {
    visitAst(tree, (node) => {
      if (node.type === "html") throw new UnsafeArticleInflowBodyError("raw HTML");
    });
  };
}

function rejectExecutableMdx() {
  return (tree) => {
    visitAst(tree, (node) => {
      if (
        node.type === "mdxjsEsm"
        || node.type === "mdxJsxFlowElement"
        || node.type === "mdxJsxTextElement"
      ) {
        throw new UnsafeArticleInflowBodyError("MDX JSX or ESM");
      }
      if (
        (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression")
        && !isPassiveEstree(node.data?.estree)
      ) {
        throw new UnsafeArticleInflowBodyError("executable MDX expression");
      }
    });
  };
}

export function isSafeArticleInflowBody(body) {
  try {
    compileSync(body, { format: "md", remarkPlugins: [rejectRawHtml] });
  } catch {
    return false;
  }

  try {
    compileSync(body, { format: "mdx", remarkPlugins: [rejectExecutableMdx] });
  } catch (error) {
    return !(error instanceof UnsafeArticleInflowBodyError);
  }
  return true;
}

const ArticleInflowItemSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/).refine((slug) => !RESERVED_SLUGS.has(slug)),
    title: z.string().min(1),
    family: z.enum(ARTICLE_FAMILIES),
    source_x_url: z.string().regex(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/),
    published_at: z.string().datetime({ offset: true }),
    body: z.string().min(1),
    body_checksum: z.string().regex(CHECKSUM),
    validator: z.object({
      verdict: z.literal("green"),
      vocabulary_version: z.string().min(1),
    }).passthrough(),
  })
  .passthrough();

const ArticleInflowFeedSchema = z
  .object({
    schema_version: z.literal(ARTICLE_INFLOW_SCHEMA_VERSION),
    environment: z.enum(["staging", "production"]),
    generated_at: z.string().datetime({ offset: true }),
    feed_checksum: z.string().regex(/^[0-9a-f]{16}$/),
    articles: z.array(ArticleInflowItemSchema),
  })
  .passthrough()
  .superRefine((feed, context) => {
    const slugs = new Set();
    feed.articles.forEach((article, index) => {
      if (slugs.has(article.slug)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["articles", index, "slug"],
          message: "duplicate slug",
        });
      }
      slugs.add(article.slug);
      if (calculateArticleBodyChecksum(article.body) !== article.body_checksum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["articles", index, "body_checksum"],
          message: "body checksum mismatch",
        });
      }
      if (!isSafeArticleInflowBody(article.body)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["articles", index, "body"],
          message: "unsafe article body",
        });
      }
    });
  });

export function parseArticleInflowFeed(payload) {
  const result = ArticleInflowFeedSchema.safeParse(payload);
  return result.success ? result.data : null;
}
