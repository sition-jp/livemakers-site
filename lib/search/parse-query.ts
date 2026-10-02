import {
  ARTICLE_FAMILIES,
  type ArticleFamily,
} from "@/lib/articles/article-model";
import { parseSeriesPageParam } from "@/lib/articles/series-pagination";
import { normalizeForSearch } from "@/lib/search/normalize";

export const SEARCH_QUERY_MAX = 100;
export const SEARCH_TERMS_MAX = 5;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ParsedSearch = {
  /** 表示・リンク用の原文 (前後空白を削り 100 字で打ち切り) */
  q: string;
  /** 正規化済みの語 (最大 5・重複なし) */
  terms: string[];
  family: ArticleFamily | null;
  page: number;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * /search の URL パラメータを読む (2026-10-02 spec)。不正な family は「すべて」、
 * 不正な page は 1 ページ目に戻す (検索語を変えた直後に 404 を見せないため)。
 */
export function parseSearchParams(raw: RawSearchParams): ParsedSearch {
  const q = first(raw.q).trim().slice(0, SEARCH_QUERY_MAX);
  const normalized = normalizeForSearch(q);
  const terms = [...new Set(normalized ? normalized.split(" ") : [])].slice(
    0,
    SEARCH_TERMS_MAX,
  );
  const familyRaw = first(raw.family);
  const family = (ARTICLE_FAMILIES as readonly string[]).includes(familyRaw)
    ? (familyRaw as ArticleFamily)
    : null;
  const page = parseSeriesPageParam(first(raw.page)) ?? 1;
  return { q, terms, family, page };
}

/** 検索ページへの locale なしの href (Link が locale を付ける)。既定値は省く。 */
export function searchHref({
  q,
  family = null,
  page = 1,
}: {
  q: string;
  family?: ArticleFamily | null;
  page?: number;
}): string {
  const params = new URLSearchParams({ q });
  if (family) params.set("family", family);
  if (page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}
