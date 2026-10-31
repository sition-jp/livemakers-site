import type { ArticleMeta } from "@/lib/articles/article-model";
import type { VideoCardData } from "@/lib/videos";

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

/** 「最新の記事」の 1 行: 記事か、動画の記事 (/videos/<slug>) */
export type LatestEntry =
  | { kind: "article"; publishedAtJst: string; article: ArticleMeta }
  | { kind: "video"; publishedAtJst: string; video: VideoCardData };

/**
 * 「最新の記事」に動画の記事を混ぜる (2026-10-31 田平氏 GO)。動画は YouTube の
 * 公開日時で記事と同じ新しい順に入り、本数は増やさない (古い記事が 1 本押し出される)。
 * 公開日時の無い動画は載せない。
 */
export function mergeLatestEntries(
  articles: readonly ArticleMeta[],
  videos: readonly VideoCardData[] = [],
  count: number = LATEST_ARTICLES_COUNT,
): LatestEntry[] {
  const entries: LatestEntry[] = [
    ...articles.map((article) => ({
      kind: "article" as const,
      publishedAtJst: article.publishedAtJst,
      article,
    })),
    ...videos.flatMap((video) =>
      video.publishedAtJst
        ? [{ kind: "video" as const, publishedAtJst: video.publishedAtJst, video }]
        : [],
    ),
  ];
  return entries
    .toSorted((left, right) => right.publishedAtJst.localeCompare(left.publishedAtJst))
    .slice(0, count);
}
