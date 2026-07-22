import "server-only";

import { compileSync } from "@mdx-js/mdx";

import {
  getAllArticles,
  getArticleBody,
} from "@/lib/articles/article-model";
import {
  buildArticleInflowPublicCatalog,
  buildArticleInflowPreviewCatalog,
  calculateArticleBodyChecksum,
  parseArticleInflowFeed,
  type ArticleInflowFeed,
  type ArticleInflowPublicCatalog,
  type ArticleInflowPreviewArticle,
  type ArticleInflowPreviewCatalog,
} from "@/lib/articles/article-inflow-contract";

export const ARTICLE_INFLOW_FEED_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_FEED_URL";
export const ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED";
export const ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY =
  "LIVEMAKERS_ARTICLE_INFLOW_PRODUCTION_FEED_URL";
export const ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_PUBLIC_ENABLED";

export interface ArticleInflowPreviewDetail {
  article: ArticleInflowPreviewArticle;
  body: string;
  declaredBodyChecksum: string;
  renderedBodyChecksum: string;
}
export type ArticleInflowPublicDetail = ArticleInflowPreviewDetail;

type AstNode = {
  type?: string;
  children?: AstNode[];
  data?: { estree?: unknown };
  [key: string]: unknown;
};

class UnsafeArticleInflowBodyError extends Error {}

function visitAst(node: AstNode, visitor: (node: AstNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) visitAst(child, visitor);
}

function isAstNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";
}

function isPassiveEstree(node: unknown): boolean {
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
  return (tree: AstNode) => {
    visitAst(tree, (node) => {
      if (node.type === "html") throw new UnsafeArticleInflowBodyError("raw HTML");
    });
  };
}

function rejectExecutableMdx() {
  return (tree: AstNode) => {
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

export function isSafeArticleInflowBody(body: string): boolean {
  try {
    compileSync(body, { format: "md", remarkPlugins: [rejectRawHtml] });
  } catch {
    return false;
  }

  try {
    compileSync(body, { format: "mdx", remarkPlugins: [rejectExecutableMdx] });
  } catch (error) {
    // Invalid MDX syntax is inert in the Markdown-only renderer. Explicitly
    // unsafe AST nodes still fail closed through the sentinel above.
    return !(error instanceof UnsafeArticleInflowBodyError);
  }
  return true;
}

export function isArticleInflowPreviewEnabled(): boolean {
  const value = process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
  return value === "1" || value === "true";
}

export function isArticleInflowPublicEnabled(): boolean {
  const value = process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
  return value === "1" || value === "true";
}

async function fetchValidatedArticleInflowFeed(
  url: string,
  fetcher: typeof fetch,
  requiredEnvironment?: ArticleInflowFeed["environment"],
): Promise<ArticleInflowFeed | null> {
  try {
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      console.warn("[article-inflow] feed response rejected; using repository-only content");
      return null;
    }
    const feed = parseArticleInflowFeed(await response.json());
    if (!feed || (requiredEnvironment && feed.environment !== requiredEnvironment)) {
      console.warn("[article-inflow] feed contract rejected; using repository-only content");
      return null;
    }
    if (feed.articles.some((article) => !isSafeArticleInflowBody(article.body))) {
      console.warn("[article-inflow] feed body safety rejected; using repository-only content");
      return null;
    }
    return feed;
  } catch {
    console.warn("[article-inflow] feed request failed; using repository-only content");
    return null;
  }
}

export async function fetchArticleInflowFeed(
  fetcher: typeof fetch = fetch,
): Promise<ArticleInflowFeed | null> {
  const url = process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
  if (!url) return null;
  return fetchValidatedArticleInflowFeed(url, fetcher);
}

export async function fetchProductionArticleInflowFeed(
  fetcher: typeof fetch = fetch,
): Promise<ArticleInflowFeed | null> {
  if (!isArticleInflowPublicEnabled()) return null;
  const url = process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
  if (!url) return null;
  return fetchValidatedArticleInflowFeed(url, fetcher, "production");
}

export async function loadArticleInflowPreviewCatalog(): Promise<ArticleInflowPreviewCatalog> {
  return buildArticleInflowPreviewCatalog(getAllArticles(), await fetchArticleInflowFeed());
}

export async function loadPublicArticleInflowCatalog(): Promise<ArticleInflowPublicCatalog> {
  return buildArticleInflowPublicCatalog(
    getAllArticles(),
    await fetchProductionArticleInflowFeed(),
  );
}

async function loadArticleInflowDetail(
  catalog: ArticleInflowPreviewCatalog,
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPreviewDetail | null> {
  const article = catalog.articles.find((candidate) => candidate.articleId === slug);
  if (!article) return null;
  const body = article.source === "inflow"
    ? article.inflowBody!
    : getArticleBody(slug, locale);
  const renderedBodyChecksum = calculateArticleBodyChecksum(body);
  return {
    article,
    body,
    declaredBodyChecksum: article.declaredBodyChecksum ?? renderedBodyChecksum,
    renderedBodyChecksum,
  };
}

export async function loadArticleInflowPreviewDetail(
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPreviewDetail | null> {
  return loadArticleInflowDetail(await loadArticleInflowPreviewCatalog(), slug, locale);
}

export async function loadPublicArticleInflowDetail(
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPublicDetail | null> {
  return loadArticleInflowDetail(await loadPublicArticleInflowCatalog(), slug, locale);
}
