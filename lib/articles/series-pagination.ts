import type { SeriesSlug } from "@/lib/articles/article-model";

/**
 * シリーズ一覧のページ分け (2026-10-02 田平氏 GO: 30 本 / 日付見出しあり)。
 * Signal が 1 ページ 352 本・HTML 874KB に達したため、全シリーズ共通で
 * 1 ページ 30 本に区切る。1 ページ目は従来の /articles/series/{series} のまま、
 * 2 ページ目以降を /articles/series/{series}/page/{n} に置く。
 * 入力の並び (catalog = 公開日時の新しい順) はそのまま保つ。
 */
export const SERIES_PAGE_SIZE = 30;

type Paginatable = { publishedAtJst: string };

export type SeriesPage<T> = {
  items: T[];
  page: number;
  totalPages: number;
};

/** 範囲外のページは null (呼び出し側で notFound)。空シリーズは空の 1 ページ目だけを持つ。 */
export function paginateSeries<T>(
  articles: readonly T[],
  page: number,
): SeriesPage<T> | null {
  const totalPages = Math.max(1, Math.ceil(articles.length / SERIES_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    return null;
  }
  const start = (page - 1) * SERIES_PAGE_SIZE;
  return {
    items: articles.slice(start, start + SERIES_PAGE_SIZE),
    page,
    totalPages,
  };
}

/** URL の page セグメントを読む。正規形 (先頭 0 なしの正の整数) 以外は null。 */
export function parseSeriesPageParam(value: string): number | null {
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function seriesPageHref(series: SeriesSlug | string, page: number): string {
  return page === 1
    ? `/articles/series/${series}`
    : `/articles/series/${series}/page/${page}`;
}

/**
 * ページ番号の並び。7 ページ以下は全部、それ以上は 先頭・末尾・現在 ±1 を残し、
 * 間を null (省略記号) で埋める。
 */
export function pageWindow(current: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const keep = new Set([1, totalPages, current - 1, current, current + 1]);
  if (current <= 3) keep.add(2);
  const pages = [...keep]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const result: (number | null)[] = [];
  for (const page of pages) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      result.push(null);
    }
    result.push(page);
  }
  return result;
}

/** 日付見出し用。publishedAtJst は +09:00 固定 (schema 検証済み) なので先頭 10 文字が JST 暦日。 */
export function groupByJstDate<T extends Paginatable>(
  items: readonly T[],
): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const date = item.publishedAtJst.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.items.push(item);
    } else {
      groups.push({ date, items: [item] });
    }
  }
  return groups;
}
