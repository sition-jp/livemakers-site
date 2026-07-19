import "server-only";

import {
  getAllArticles,
  getArticleBody,
} from "@/lib/articles/article-model";
import {
  buildArticleInflowPreviewCatalog,
  calculateArticleBodyChecksum,
  parseArticleInflowFeed,
  type ArticleInflowFeed,
  type ArticleInflowPreviewArticle,
  type ArticleInflowPreviewCatalog,
} from "@/lib/articles/article-inflow-contract";

export const ARTICLE_INFLOW_FEED_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_FEED_URL";
export const ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED";

export interface ArticleInflowPreviewDetail {
  article: ArticleInflowPreviewArticle;
  body: string;
  declaredBodyChecksum: string;
  renderedBodyChecksum: string;
}

export function isArticleInflowPreviewEnabled(): boolean {
  const value = process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
  return value === "1" || value === "true";
}

export async function fetchArticleInflowFeed(
  fetcher: typeof fetch = fetch,
): Promise<ArticleInflowFeed | null> {
  const url = process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
  if (!url) return null;
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
    if (!feed) {
      console.warn("[article-inflow] feed contract rejected; using repository-only content");
    }
    return feed;
  } catch {
    console.warn("[article-inflow] feed request failed; using repository-only content");
    return null;
  }
}

export async function loadArticleInflowPreviewCatalog(): Promise<ArticleInflowPreviewCatalog> {
  return buildArticleInflowPreviewCatalog(getAllArticles(), await fetchArticleInflowFeed());
}

export async function loadArticleInflowPreviewDetail(
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPreviewDetail | null> {
  const catalog = await loadArticleInflowPreviewCatalog();
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
