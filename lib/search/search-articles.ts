import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { familyLabelJa } from "@/lib/articles/family-labels";
import { normalizeForSearch } from "@/lib/search/normalize";

/**
 * 一致の種類。title = タイトルだけで全語を含む / meta = タイトル + 抜粋 + 種別名で
 * 全語を含む / body = 本文まで含めて初めて全語を含む (第2段階)。
 */
export type SearchTier = "title" | "meta" | "body";
export const SEARCH_TIERS: readonly SearchTier[] = ["title", "meta", "body"];

export type SearchHit<T extends ArticleMeta = ArticleMeta> = {
  article: T;
  tier: SearchTier;
};

const newestFirst = (left: SearchHit, right: SearchHit) =>
  right.article.publishedAtJst.localeCompare(left.article.publishedAtJst);

/**
 * サイト内検索 (2026-10-02 spec)。対象 = タイトル + 抜粋 + 種別の日本語名、
 * 第2段階では bodyTexts (slug → normalizeForSearch 済みの本文) も。全語 AND の
 * 部分一致。JST 今日より先の公開日は除外 (selectLatestArticles と同じ today-gate)。
 * 速報も含める。並び = title → meta → body の群、各群は新しい順。
 */
export function searchArticles<T extends ArticleMeta>(
  articles: readonly T[],
  terms: readonly string[],
  todayJst: string,
  bodyTexts?: ReadonlyMap<string, string>,
): SearchHit<T>[] {
  if (terms.length === 0) return [];
  const hits: SearchHit<T>[] = [];
  for (const article of articles) {
    if (article.publishedAtJst.slice(0, 10) > todayJst) continue;
    const title = normalizeForSearch(article.titleJa);
    if (terms.every((term) => title.includes(term))) {
      hits.push({ article, tier: "title" });
      continue;
    }
    const meta = [
      title,
      normalizeForSearch(article.excerptJa ?? ""),
      normalizeForSearch(familyLabelJa(article.family)),
    ].join("\n");
    if (terms.every((term) => meta.includes(term))) {
      hits.push({ article, tier: "meta" });
      continue;
    }
    const body = bodyTexts?.get(article.articleId);
    if (body && terms.every((term) => meta.includes(term) || body.includes(term))) {
      hits.push({ article, tier: "body" });
    }
  }
  return SEARCH_TIERS.flatMap((tier) =>
    hits.filter((hit) => hit.tier === tier).toSorted(newestFirst),
  );
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
