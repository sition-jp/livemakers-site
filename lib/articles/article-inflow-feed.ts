import "server-only";

import {
  getAllArticles,
  getArticleBody,
} from "@/lib/articles/article-model";
import {
  buildArticleInflowPublicCatalog,
  buildArticleInflowPreviewCatalog,
  calculateArticleBodyChecksum,
  isSafeArticleInflowBody,
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
export { isSafeArticleInflowBody };

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
