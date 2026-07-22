import {
  ArticleMetaSchema,
  type ArticleMeta,
} from "@/lib/articles/article-model";
import type { ArticleInflowFeed } from "@/lib/articles/article-inflow-validation.mjs";

export {
  ARTICLE_INFLOW_SCHEMA_VERSION,
  calculateArticleBodyChecksum,
  isSafeArticleInflowBody,
  parseArticleInflowFeed,
} from "@/lib/articles/article-inflow-validation.mjs";
export type { ArticleInflowFeed };
export type ArticleInflowPreviewArticle = ArticleMeta & {
  source: "repository" | "inflow";
  declaredBodyChecksum?: string;
  inflowBody?: string;
};
export interface ArticleInflowPreviewCatalog {
  articles: ArticleInflowPreviewArticle[];
  feedChecksum: string | null;
}
export type ArticleInflowPublicArticle = ArticleInflowPreviewArticle;
export type ArticleInflowPublicCatalog = ArticleInflowPreviewCatalog;

function toJstParts(value: string) {
  const jst = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  const date = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
  const time = `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  return { date, time, iso: `${date}T${time}:${pad(jst.getUTCSeconds())}+09:00` };
}

function mapInflowArticle(
  article: ArticleInflowFeed["articles"][number],
  hrefBase: string,
): ArticleInflowPreviewArticle {
  const jst = toJstParts(article.published_at);
  const parsed = ArticleMetaSchema.parse({
    articleId: article.slug,
    family: article.family,
    titleJa: article.title,
    publishedAtJst: jst.iso,
    publishedLabel: `${jst.date.slice(5)} ${jst.time} 公開`,
    dataDate: article.family.startsWith("mkt12-") ? jst.date : undefined,
    lanes: [],
    sourceXUrl: article.source_x_url,
  });
  return {
    ...parsed,
    href: `${hrefBase}/${article.slug}`,
    source: "inflow",
    declaredBodyChecksum: article.body_checksum,
    inflowBody: article.body,
  };
}

function buildArticleInflowCatalog(
  repositoryArticles: ArticleMeta[],
  feed: ArticleInflowFeed | null,
  hrefBase: string,
): ArticleInflowPreviewCatalog {
  const repositorySlugs = new Set(repositoryArticles.map((article) => article.articleId));
  const repository = repositoryArticles.map((article) => ({
    ...article,
    href: `${hrefBase}/${article.articleId}`,
    source: "repository" as const,
  }));
  const inflow = (feed?.articles ?? [])
    .filter((article) => !repositorySlugs.has(article.slug))
    .map((article) => mapInflowArticle(article, hrefBase));
  return {
    articles: [...repository, ...inflow].sort((left, right) =>
      right.publishedAtJst.localeCompare(left.publishedAtJst),
    ),
    feedChecksum: feed?.feed_checksum ?? null,
  };
}

export function buildArticleInflowPreviewCatalog(
  repositoryArticles: ArticleMeta[],
  feed: ArticleInflowFeed | null,
): ArticleInflowPreviewCatalog {
  return buildArticleInflowCatalog(
    repositoryArticles,
    feed,
    "/article-inflow-preview/articles",
  );
}

export function buildArticleInflowPublicCatalog(
  repositoryArticles: ArticleMeta[],
  feed: ArticleInflowFeed | null,
): ArticleInflowPublicCatalog {
  return buildArticleInflowCatalog(repositoryArticles, feed, "/articles");
}
