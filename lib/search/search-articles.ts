import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { familyLabelJa } from "@/lib/articles/family-labels";
import { normalizeForSearch } from "@/lib/search/normalize";

export type SearchHit<T extends ArticleMeta = ArticleMeta> = {
  article: T;
  /** タイトルだけで全語を含む (結果の前の群) */
  titleMatch: boolean;
};

const newestFirst = (left: SearchHit, right: SearchHit) =>
  right.article.publishedAtJst.localeCompare(left.article.publishedAtJst);

/**
 * サイト内検索 第1段階 (2026-10-02 spec)。対象 = タイトル + 抜粋 + 種別の日本語名。
 * 全語 AND の部分一致。JST 今日より先の公開日は除外 (selectLatestArticles と同じ
 * today-gate)。速報も含める。並び = タイトル一致群 → その他、各群は新しい順。
 */
export function searchArticles<T extends ArticleMeta>(
  articles: readonly T[],
  terms: readonly string[],
  todayJst: string,
): SearchHit<T>[] {
  if (terms.length === 0) return [];
  const hits: SearchHit<T>[] = [];
  for (const article of articles) {
    if (article.publishedAtJst.slice(0, 10) > todayJst) continue;
    const title = normalizeForSearch(article.titleJa);
    const haystack = [
      title,
      normalizeForSearch(article.excerptJa ?? ""),
      normalizeForSearch(familyLabelJa(article.family)),
    ].join("\n");
    if (!terms.every((term) => haystack.includes(term))) continue;
    hits.push({
      article,
      titleMatch: terms.every((term) => title.includes(term)),
    });
  }
  return [
    ...hits.filter((hit) => hit.titleMatch).toSorted(newestFirst),
    ...hits.filter((hit) => !hit.titleMatch).toSorted(newestFirst),
  ];
}

export function countByFamily(
  hits: readonly SearchHit[],
): Partial<Record<ArticleFamily, number>> {
  const counts: Partial<Record<ArticleFamily, number>> = {};
  for (const { article } of hits) {
    counts[article.family] = (counts[article.family] ?? 0) + 1;
  }
  return counts;
}
