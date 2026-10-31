import type { ArticleMeta } from "@/lib/articles/article-model";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import { REGION_MODULES } from "./gradient-ledger";

/**
 * 右カラム (lagging) の記事の枠を「各枠の最新記事の公開順」に並べる
 * (2026-08-23 田平氏 GO・A 案 = すべて新着順)。2026-10-29 田平氏 GO (C 案) で
 * restart-map (金融再起動の現在地) が 5 つ目の枠として加わった。2026-10-31 田平氏
 * GO で video (最新の動画) も固定の枠をやめ、YouTube の公開日時で同じ並べ替えに混ざる。
 *
 * - 台帳 (REGION_MODULES.lagging) は「枠の集合 + 末尾固定枠の順」の正本として
 *   不変。本関数はその記事の枠だけを publishedAtJst 降順に並べ替え、末尾の
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
  "restart-map",
] as const;

export type LaggingArticleModule = (typeof LAGGING_ARTICLE_MODULES)[number];

export type LaggingLatestSlots = Pick<
  HomeSlots,
  | "deepDives"
  | "atlasLatest"
  | "mkt12WeekendLatest"
  | "weeklyBriefLatest"
  | "restartMapLatest"
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
    case "restart-map":
      return slots.restartMapLatest;
  }
}

/** 動画の枠は slots の外 (content/videos) から来るので、公開日時だけを別に受け取る */
const VIDEO_MODULE = "video";

export interface LaggingOrderOptions {
  /** 最新の動画の YouTube 公開日時。動画が無い / 日時が無いときは null (記事の無い枠と同じ扱い) */
  videoPublishedAtJst?: string | null;
  ledger?: readonly string[];
}

export function orderLaggingModules(
  slots: LaggingLatestSlots,
  { videoPublishedAtJst = null, ledger = REGION_MODULES.lagging }: LaggingOrderOptions = {},
): string[] {
  const ledgerIndex = new Map(ledger.map((module, index) => [module, index]));
  const byLedger = (left: string, right: string): number =>
    (ledgerIndex.get(left) ?? 0) - (ledgerIndex.get(right) ?? 0);
  const isSorted = (module: string): boolean =>
    isLaggingArticleModule(module) || module === VIDEO_MODULE;
  const publishedAt = (module: string): string | null =>
    module === VIDEO_MODULE
      ? videoPublishedAtJst
      : (laggingModuleLatest(slots, module as LaggingArticleModule)?.publishedAtJst ?? null);

  const sorted = ledger.filter(isSorted).toSorted((left, right) => {
    const leftAt = publishedAt(left);
    const rightAt = publishedAt(right);
    if (leftAt === rightAt) return byLedger(left, right);
    if (leftAt === null) return 1;
    if (rightAt === null) return -1;
    return rightAt.localeCompare(leftAt);
  });
  const tail = ledger.filter((module) => !isSorted(module));
  return [...sorted, ...tail];
}
