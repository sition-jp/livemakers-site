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
  "future-atlas",
];
const ARTICLE_LANES = ["macro", "crypto", "rwa"];
const CHECKSUM = /^[0-9a-f]{64}$/;
const RESERVED_SLUGS = new Set(["today", "series", "archive"]);

// T4-1 (sub-repo inflow/provenance.py) と同一の排他 contract:
// mirror 型 = source_x_url 必須・provenance 禁止 (従来検証・不変) /
// site-first 型 = provenance 必須・source_x_url 禁止。両立も欠落も reject。
export const SITE_FIRST_LANE = "P2-LVM-SITEFIRST-G1";
export const SITE_FIRST_DOCTRINE = "livemakers-sitefirst-policy-publish";
// P2-LVM-INFLOW-G2 (P0 承認 2026-08-07): thumbnail_* は mirror 記事も運べる
// (D1 結合鎖で producer が付与)。site-first 専用のままなのは excerpt / lanes。
const SITE_FIRST_ONLY_FIELDS = ["excerpt", "lanes"];

// D3: サムネの正当性宣言。値は no_overlay のみ (overlay 由来アセットの遮断)。
export const ARTICLE_THUMBNAIL_DOCTRINE = "no_overlay";
// D3: 配信 Blob の exact origin (これ以外の host は site 側で reject)
export const ARTICLE_THUMBNAIL_ORIGIN =
  "https://p80f4ywborfbatou.public.blob.vercel-storage.com";

const thumbnailFields = {
  thumbnail_url: z.string().url().startsWith("https://").optional(),
  thumbnail_checksum: z.string().regex(CHECKSUM).optional(),
  thumbnail_doctrine: z.literal(ARTICLE_THUMBNAIL_DOCTRINE).optional(),
};

const ProvenanceSchema = z.union([
  z.strictObject({
    approval_model: z.literal("policy"),
    lane: z.literal(SITE_FIRST_LANE),
    doctrine: z.literal(SITE_FIRST_DOCTRINE),
  }),
  z.strictObject({
    approval_model: z.literal("go_record"),
    go_record_id: z.string().trim().min(1),
  }),
]);

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

const articleInflowItemBase = {
  slug: z.string().regex(/^[a-z0-9-]+$/).refine((slug) => !RESERVED_SLUGS.has(slug)),
  title: z.string().min(1),
  family: z.enum(ARTICLE_FAMILIES),
  published_at: z.string().datetime({ offset: true }),
  body: z.string().min(1),
  body_checksum: z.string().regex(CHECKSUM),
  validator: z.object({
    verdict: z.literal("green"),
    vocabulary_version: z.string().min(1),
  }).passthrough(),
};

const MirrorArticleSchema = z
  .object({
    ...articleInflowItemBase,
    ...thumbnailFields,
    source_x_url: z.string().regex(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/),
  })
  .passthrough();

const SiteFirstArticleSchema = z
  .object({
    ...articleInflowItemBase,
    ...thumbnailFields,
    provenance: ProvenanceSchema,
    excerpt: z.string().min(1).optional(),
    lanes: z
      .array(z.enum(ARTICLE_LANES))
      .min(1)
      .refine((lanes) => new Set(lanes).size === lanes.length, "duplicate lane")
      .optional(),
  })
  .passthrough();

const ArticleInflowItemSchema = z
  .union([MirrorArticleSchema, SiteFirstArticleSchema])
  .superRefine((article, context) => {
    const hasMirror = "source_x_url" in article;
    const hasSiteFirst = "provenance" in article;
    if (hasMirror === hasSiteFirst) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "article must be exactly one of mirror (source_x_url) or site-first (provenance)",
      });
      return;
    }
    if (hasSiteFirst) {
      // union は passthrough のため provenance の完全一致を再検証する
      // (mixed 記事が MirrorArticleSchema 側で成立しても上の排他で落ちる)
      const provenance = ProvenanceSchema.safeParse(article.provenance);
      if (!provenance.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance"],
          message: "invalid site-first provenance",
        });
      }
      return;
    }
    const carried = SITE_FIRST_ONLY_FIELDS.filter((field) => field in article);
    if (carried.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `mirror article carries site-first fields: ${carried.join(",")}`,
      });
    }
  });

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

// ---- catalog v1 (P2-LVM-FEEDSPLIT-G1) ----------------------------------
// v0 feed (本文込み 2MB 超) の transport 分割。catalog item = v0 item から
// body を落とし body_url (origin pin) を足した射影で、mirror / site-first の
// 排他 contract は v0 と同一。body の checksum 再計算 + MDX 安全検証は
// parseArticleInflowBody (記事詳細の描画時・該当 1 記事のみ) へ移動する —
// これが per-render CPU 削減の本体。v0 の schema / parse は 1 文字も変えない。

export const ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION =
  "livemakers_article_inflow_catalog_v1";
export const ARTICLE_INFLOW_BODY_SCHEMA_VERSION =
  "livemakers_article_inflow_body_v1";
// body_url の配信 origin pin (サムネと同一 Blob store)
export const ARTICLE_BLOB_ORIGIN = ARTICLE_THUMBNAIL_ORIGIN;

const catalogItemBase = {
  ...articleInflowItemBase,
  body_url: z.string().url().startsWith(`${ARTICLE_BLOB_ORIGIN}/`),
};
delete catalogItemBase.body;

const MirrorCatalogArticleSchema = z
  .object({
    ...catalogItemBase,
    ...thumbnailFields,
    source_x_url: z.string().regex(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/),
  })
  .passthrough();

const SiteFirstCatalogArticleSchema = z
  .object({
    ...catalogItemBase,
    ...thumbnailFields,
    provenance: ProvenanceSchema,
    excerpt: z.string().min(1).optional(),
    lanes: z
      .array(z.enum(ARTICLE_LANES))
      .min(1)
      .refine((lanes) => new Set(lanes).size === lanes.length, "duplicate lane")
      .optional(),
  })
  .passthrough();

const ArticleInflowCatalogItemSchema = z
  .union([MirrorCatalogArticleSchema, SiteFirstCatalogArticleSchema])
  .superRefine((article, context) => {
    const hasMirror = "source_x_url" in article;
    const hasSiteFirst = "provenance" in article;
    if (hasMirror === hasSiteFirst) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "article must be exactly one of mirror (source_x_url) or site-first (provenance)",
      });
      return;
    }
    if (hasSiteFirst) {
      const provenance = ProvenanceSchema.safeParse(article.provenance);
      if (!provenance.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance"],
          message: "invalid site-first provenance",
        });
      }
      return;
    }
    const carried = SITE_FIRST_ONLY_FIELDS.filter((field) => field in article);
    if (carried.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `mirror article carries site-first fields: ${carried.join(",")}`,
      });
    }
  });

const ArticleInflowCatalogSchema = z
  .object({
    schema_version: z.literal(ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION),
    environment: z.enum(["staging", "production"]),
    generated_at: z.string().datetime({ offset: true }),
    feed_checksum: z.string().regex(/^[0-9a-f]{16}$/),
    source_feed_checksum: z.string().regex(/^[0-9a-f]{16}$/),
    articles: z.array(ArticleInflowCatalogItemSchema),
  })
  .passthrough()
  .superRefine((catalog, context) => {
    const slugs = new Set();
    catalog.articles.forEach((article, index) => {
      if (slugs.has(article.slug)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["articles", index, "slug"],
          message: "duplicate slug",
        });
      }
      slugs.add(article.slug);
    });
  });

export function parseArticleInflowCatalog(payload) {
  const result = ArticleInflowCatalogSchema.safeParse(payload);
  return result.success ? result.data : null;
}

const ArticleInflowBodySchema = z
  .object({
    schema_version: z.literal(ARTICLE_INFLOW_BODY_SCHEMA_VERSION),
    slug: z.string().min(1),
    body_checksum: z.string().regex(CHECKSUM),
    body: z.string().min(1),
  })
  .passthrough();

export function parseArticleInflowBody(payload, { slug, bodyChecksum }) {
  const result = ArticleInflowBodySchema.safeParse(payload);
  if (!result.success) return null;
  const parsed = result.data;
  if (parsed.slug !== slug) return null;
  if (parsed.body_checksum !== bodyChecksum) return null;
  if (calculateArticleBodyChecksum(parsed.body) !== bodyChecksum) return null;
  if (!isSafeArticleInflowBody(parsed.body)) return null;
  return parsed.body;
}
