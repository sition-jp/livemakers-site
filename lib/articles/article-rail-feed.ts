import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * 記事ページの右レーン (カテゴリ索引) と関連記事を、ブラウザが
 * /api/article-rail から読んで描くための中身 (2026-11-20・Vercel ISR Writes 削減)。
 *
 * 記事ページの HTML にこの 2 つを焼くと、新しい記事が出るたびに全記事ページの
 * 中身が変わり、作り直すたびに ISR の書き込み料金が掛かる (Vercel は中身が前回と
 * 同じなら書き込みを課金しない)。11/13〜19 の実測で記事ページの書き込みは
 * LiveMakers 全体の 75%。LifeMakers は 10/22 (#102) に同じ直しを入れて効いている。
 *
 * この関数群は fs を読まない (ブラウザでも動く)。サーバー側の組み立ては
 * lib/articles/article-rail-feed-server.ts。
 */

export type ArticleRailFeed = {
  articles: ArticleMeta[];
  /** 未来アトラスを公開面に出しているか (レーンの見出しと入口が変わる) */
  surfacePublished: boolean;
};

/** 全体の新しい順で残す本数 (最新の記事 20 本 + 開いている記事の除外 + 関連記事の余裕)。 */
export const RAIL_FEED_LATEST_COUNT = 25;
/** シリーズごとに残す本数 (開いている Deep Dive の枠 5 本 + 開いている記事の除外 1 本)。 */
export const RAIL_FEED_PER_FAMILY_COUNT = 6;

const byNewest = (left: ArticleMeta, right: ArticleMeta): number => {
  const byDate = right.publishedAtJst.localeCompare(left.publishedAtJst);
  return byDate !== 0 ? byDate : right.articleId.localeCompare(left.articleId);
};

/**
 * レーンと関連記事に要る分だけ残す。全体の新しい 25 本と、シリーズごとの新しい
 * 6 本の和集合を新しい順で返す (同じ記事は 1 回)。
 */
export function trimRailArticles(articles: readonly ArticleMeta[]): ArticleMeta[] {
  const unique = new Map<string, ArticleMeta>();
  for (const article of articles) {
    if (!unique.has(article.articleId)) unique.set(article.articleId, article);
  }
  const sorted = [...unique.values()].toSorted(byNewest);
  const keep = new Set(sorted.slice(0, RAIL_FEED_LATEST_COUNT).map((article) => article.articleId));
  const perFamily = new Map<string, number>();
  for (const article of sorted) {
    const seen = perFamily.get(article.family) ?? 0;
    if (seen < RAIL_FEED_PER_FAMILY_COUNT) keep.add(article.articleId);
    perFamily.set(article.family, seen + 1);
  }
  return sorted.filter((article) => keep.has(article.articleId));
}

export function isArticleRailFeed(value: unknown): value is ArticleRailFeed {
  if (!value || typeof value !== "object") return false;
  const { articles, surfacePublished } = value as Record<string, unknown>;
  return (
    typeof surfacePublished === "boolean" &&
    Array.isArray(articles) &&
    articles.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as ArticleMeta).articleId === "string" &&
        typeof (item as ArticleMeta).family === "string" &&
        typeof (item as ArticleMeta).titleJa === "string" &&
        typeof (item as ArticleMeta).publishedAtJst === "string" &&
        typeof (item as ArticleMeta).href === "string" &&
        Array.isArray((item as ArticleMeta).lanes),
    )
  );
}
