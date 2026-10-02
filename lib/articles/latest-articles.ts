import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * 「最新の記事」の選定 (ホーム右カラム⑤と一覧ページ右レールの単一導出)。
 * - 2026-08-14 田平氏指示: 20 本。
 * - 2026-09-11 Task 13: flash (速報) は載せない (専用シリーズページのみ)。
 * - 記事の時計 (JST 今日) より先の公開日は載せない (normalizeHomeInput と同じ today-gate)。
 * - 公開日時の新しい順。
 */
export const LATEST_ARTICLES_COUNT = 20;

export function selectLatestArticles(
  articles: readonly ArticleMeta[],
  articleToday: string,
  count: number = LATEST_ARTICLES_COUNT,
): ArticleMeta[] {
  return articles
    .filter(
      (article) =>
        article.family !== "flash" &&
        article.publishedAtJst.slice(0, 10) <= articleToday,
    )
    .toSorted((left, right) =>
      right.publishedAtJst.localeCompare(left.publishedAtJst),
    )
    .slice(0, count);
}
