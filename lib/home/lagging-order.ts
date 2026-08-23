import type { ArticleMeta } from "@/lib/articles/article-model";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import { REGION_MODULES } from "./gradient-ledger";

/**
 * 右カラム (lagging) の記事 4 枠を「各枠の最新記事の公開順」に並べる
 * (2026-08-23 田平氏 GO・A 案 = 4 枠すべて新着順)。
 *
 * - 台帳 (REGION_MODULES.lagging) は「枠の集合 + 末尾固定枠の順」の正本として
 *   不変。本関数はその記事 4 枠だけを publishedAtJst 降順に並べ替え、末尾の
 *   索引枠 (latest-articles / turning-point-reserved) は台帳順のまま後ろに付ける
 * - 記事が無い枠は記事ブロックの末尾 (複数なら台帳順)・同時刻は台帳順
 * - DOM 順で並べるのでモバイル縦積み・スクリーンリーダーも自動で一致する
 *   (doctrine §4「DOM 順 = 優先順」の原則は維持・優先順の決め方だけが動的)
 */
export const LAGGING_ARTICLE_MODULES = [
  "deep-dive",
  "atlas-entry",
  "mkt12-weekend",
  "weekly-brief",
] as const;

export type LaggingArticleModule = (typeof LAGGING_ARTICLE_MODULES)[number];

export type LaggingLatestSlots = Pick<
  HomeSlots,
  "deepDives" | "atlasLatest" | "mkt12WeekendLatest" | "weeklyBriefLatest"
>;

export function isLaggingArticleModule(
  module: string,
): module is LaggingArticleModule {
  return (LAGGING_ARTICLE_MODULES as readonly string[]).includes(module);
}

/** 枠 → その枠が描く最新 1 本 (deep-dive は featured = deepDives[0])。 */
export function laggingModuleLatest(
  slots: LaggingLatestSlots,
  module: LaggingArticleModule,
): ArticleMeta | null {
  switch (module) {
    case "deep-dive":
      return slots.deepDives[0] ?? null;
    case "atlas-entry":
      return slots.atlasLatest;
    case "mkt12-weekend":
      return slots.mkt12WeekendLatest;
    case "weekly-brief":
      return slots.weeklyBriefLatest;
  }
}

export function orderLaggingModules(
  slots: LaggingLatestSlots,
  ledger: readonly string[] = REGION_MODULES.lagging,
): string[] {
  const ledgerIndex = new Map(ledger.map((module, index) => [module, index]));
  const byLedger = (left: string, right: string): number =>
    (ledgerIndex.get(left) ?? 0) - (ledgerIndex.get(right) ?? 0);

  const articleModules = ledger.filter(isLaggingArticleModule);
  const sorted = articleModules.toSorted((left, right) => {
    const leftAt = laggingModuleLatest(slots, left)?.publishedAtJst ?? null;
    const rightAt = laggingModuleLatest(slots, right)?.publishedAtJst ?? null;
    if (leftAt === rightAt) return byLedger(left, right);
    if (leftAt === null) return 1;
    if (rightAt === null) return -1;
    return rightAt.localeCompare(leftAt);
  });
  const tail = ledger.filter((module) => !isLaggingArticleModule(module));
  return [...sorted, ...tail];
}
