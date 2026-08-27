import {
  ArticleMetaSchema,
  type ArticleMeta,
} from "@/lib/articles/article-model";
import type {
  ArticleInflowFeed,
  ArticleInflowSource,
  ArticleInflowSourceItem,
} from "@/lib/articles/article-inflow-validation.mjs";

export {
  ARTICLE_INFLOW_SCHEMA_VERSION,
  ARTICLE_THUMBNAIL_DOCTRINE,
  ARTICLE_THUMBNAIL_ORIGIN,
  calculateArticleBodyChecksum,
  isSafeArticleInflowBody,
  parseArticleInflowFeed,
} from "@/lib/articles/article-inflow-validation.mjs";
export type { ArticleInflowFeed, ArticleInflowSource };
export type ArticleInflowPreviewArticle = ArticleMeta & {
  source: "repository" | "inflow";
  declaredBodyChecksum?: string;
  inflowBody?: string;
  // FEEDSPLIT T6: catalog v1 経由の記事は本文を運ばず、詳細描画時に
  // この URL から取得する (v0 feed 経由は従来どおり inflowBody を運ぶ)
  bodyUrl?: string;
  // thumbnailUrl は ArticleMeta へ移動 (INFLOW-G2 T1a — mirror 記事も運ぶため)
  thumbnailChecksum?: string;
};
export interface ArticleInflowPreviewCatalog {
  articles: ArticleInflowPreviewArticle[];
  feedChecksum: string | null;
}
export type ArticleInflowPublicArticle = ArticleInflowPreviewArticle;
export interface ArticleInflowPublicCatalog
  extends ArticleInflowPreviewCatalog {
  feedPresent: boolean;
}

function toJstParts(value: string) {
  const jst = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  const date = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
  const time = `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  return { date, time, iso: `${date}T${time}:${pad(jst.getUTCSeconds())}+09:00` };
}

function mapInflowArticle(
  article: ArticleInflowSourceItem,
  hrefBase: string,
): ArticleInflowPreviewArticle {
  const jst = toJstParts(article.published_at);
  const parsed = ArticleMetaSchema.parse({
    articleId: article.slug,
    family: article.family,
    titleJa: article.title,
    // TQ3: site-first 記事は packet meta 由来の excerpt / lanes を伝播。
    // mirror 記事は従来どおり (excerpt なし・lanes 空)
    excerptJa: article.excerpt,
    publishedAtJst: jst.iso,
    publishedLabel: `${jst.date.slice(5)} ${jst.time} 公開`,
    dataDate: article.family.startsWith("mkt12-") ? jst.date : undefined,
    lanes: article.lanes ?? [],
    sourceXUrl: article.source_x_url,
    // INFLOW-G2 T1a: ここへ届く thumbnail_url は検証通過済み
    // (stripUnverifiedThumbnails が feed 取得時に不正分を剥がしている)。
    // ArticleMeta に載せることで home slots (LeadArticleCard / ArticleCardSmall)
    // まで追加配線なしで伝播する
    thumbnailUrl: article.thumbnail_url,
    // 2026-08-14 (radar B 経路): packet が radar_topic_id を運んできたら
    // ArticleMeta.radarTopicId へ透過 — 「速報 — 観測から記事へ」の昇格ペア
    // (select-home-slots radarPair) はこのフィールドで観測と記事を結合する
    radarTopicId: (article as { radar_topic_id?: string }).radar_topic_id,
  });
  return {
    ...parsed,
    href: `${hrefBase}/${article.slug}`,
    source: "inflow",
    declaredBodyChecksum: article.body_checksum,
    inflowBody: article.body,
    bodyUrl: (article as { body_url?: string }).body_url,
    thumbnailChecksum: article.thumbnail_checksum,
  };
}

function buildArticleInflowCatalog(
  repositoryArticles: ArticleMeta[],
  feed: ArticleInflowSource | null,
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
  feed: ArticleInflowSource | null,
): ArticleInflowPreviewCatalog {
  return buildArticleInflowCatalog(
    repositoryArticles,
    feed,
    "/article-inflow-preview/articles",
  );
}

export function buildArticleInflowPublicCatalog(
  repositoryArticles: ArticleMeta[],
  feed: ArticleInflowSource | null,
): ArticleInflowPublicCatalog {
  return {
    ...buildArticleInflowCatalog(repositoryArticles, feed, "/articles"),
    feedPresent: feed !== null,
  };
}
