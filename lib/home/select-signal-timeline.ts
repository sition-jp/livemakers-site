import type { ArticleMeta } from "@/lib/articles/article-model";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 中央カラム② Signal 時系列の選定 (D6 / G44)。
 * family==="signal" のみ・excludeIds を先に除外 (左③ FlashPromotion が記事リンクを
 * 描くときの articleId・D5 対称契約) → 直近 24h の全件 → floor 未満なら最新の older で補完。
 * floor は下限であって上限ではない (窓内が floor を超えれば全件返す)。降順・重複なし。
 * publishedAtJst / now は共にオフセット付きの絶対時刻で比較する。
 */
export function selectSignalTimeline(args: {
  articles: ArticleMeta[];
  now: Date;
  floor?: number;
  excludeIds?: readonly string[];
}): ArticleMeta[] {
  const { articles, now, floor = 10, excludeIds = [] } = args;
  const excluded = new Set(excludeIds);
  const signals = articles
    .filter((article) => article.family === "signal" && !excluded.has(article.articleId))
    .toSorted((left, right) =>
      right.publishedAtJst.localeCompare(left.publishedAtJst),
    );

  const cutoff = now.getTime() - WINDOW_MS;
  const within = signals.filter(
    (article) => new Date(article.publishedAtJst).getTime() >= cutoff,
  );
  if (within.length >= floor) {
    return within;
  }
  const older = signals.filter(
    (article) => new Date(article.publishedAtJst).getTime() < cutoff,
  );
  return [...within, ...older.slice(0, floor - within.length)];
}
