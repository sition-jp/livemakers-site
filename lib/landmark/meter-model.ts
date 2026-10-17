import {
  LANDMARK_ROW_KEYS,
  type LandmarkItem,
  type LandmarkMeterData,
  type LandmarkRowKey,
  type LandmarkState,
} from "@/lib/landmark/meter-feed";

/**
 * 節目の計器盤の 6 行 (core spec 2026-10-16-lvm-landmark-meter-design §5)。並びは固定で、
 * 近い順に並べ替えない。鮮度は SDE (livemakers_export/landmark_meter.py) と同じ物差しで描画時にも見直す —
 * 配信が止まって古い feed が残っても、古い値を新しいように見せない。
 */
export type LandmarkCopyKey = "ma200w" | "macd2w" | "macd1m" | "mvrv" | "funding" | "etf";
export type LandmarkBadge = "fired" | "cooldown" | "afterCross" | "aboveZero";
export type LandmarkRecoverBadge = "fired" | "waitingPremise";

type Cadence = "weekly" | "2w" | "monthly" | "daily" | "etf";

export const LANDMARK_CHECKED_MAX_HOURS = 36;
export const LANDMARK_BAR_MAX_AGE_DAYS: Record<Cadence, number> = {
  weekly: 10,
  "2w": 18,
  monthly: 35,
  daily: 3,
  etf: 30,
};
/** 日次の指標と ETF は、点灯した日を含めて 7 日間〔点灯〕を出す (経過 0〜6 日) */
export const LANDMARK_FIRED_DAYS = 7;
/** ETF は値の日付が 7 日以上前なら日付を目立たせる (取得元 TFTC の更新が止まったとき) */
export const LANDMARK_ETF_STALE_DAYS = 7;

const ROW_META: Record<LandmarkRowKey, { copyKey: LandmarkCopyKey; cadence: Cadence }> = {
  btc_below_200wma: { copyKey: "ma200w", cadence: "weekly" },
  btc_macd_2w_golden_below_zero: { copyKey: "macd2w", cadence: "2w" },
  btc_macd_1m_golden_cross: { copyKey: "macd1m", cadence: "monthly" },
  btc_mvrv_1: { copyKey: "mvrv", cadence: "daily" },
  btc_funding_30d_negative: { copyKey: "funding", cadence: "daily" },
  btc_etf_cum_high: { copyKey: "etf", cadence: "etf" },
};

const STATE_BADGE: Record<LandmarkState, LandmarkBadge | null> = {
  armed: null,
  cooldown: "cooldown",
  after_cross: "afterCross",
  above_zero: "aboveZero",
};

export interface LandmarkRow {
  key: LandmarkRowKey;
  copyKey: LandmarkCopyKey;
  /** 新鮮な値が無ければ null (「—（データ更新待ち）」の行) */
  item: LandmarkItem | null;
  badge: LandmarkBadge | null;
  recoverBadge: LandmarkRecoverBadge | null;
  staleEmphasis: boolean;
}

const DAY_MS = 86_400_000;
const JST_OFFSET_MS = 9 * 3_600_000;

function jstToday(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function isFresh(item: LandmarkItem, cadence: Cadence, now: Date, today: string): boolean {
  const checked = Date.parse(item.checkedAtJst);
  if (Number.isNaN(checked)) return false;
  if (now.getTime() - checked > LANDMARK_CHECKED_MAX_HOURS * 3_600_000) return false;
  return daysBetween(item.barDate, today) <= LANDMARK_BAR_MAX_AGE_DAYS[cadence];
}

function recentlyFired(lastEvent: string | null, today: string): boolean {
  if (!lastEvent) return false;
  const age = daysBetween(lastEvent, today);
  return age >= 0 && age < LANDMARK_FIRED_DAYS;
}

function rowFor(key: LandmarkRowKey, data: LandmarkMeterData, now: Date, today: string): LandmarkRow {
  const { copyKey, cadence } = ROW_META[key];
  const found = data.items.find((candidate) => candidate.key === key);
  const item = found && isFresh(found, cadence, now, today) ? found : null;
  if (!item) {
    return { key, copyKey, item: null, badge: null, recoverBadge: null, staleEmphasis: false };
  }
  // 足の指標は点灯した足が最新の足である間、日次の指標と ETF は点灯から 7 日間
  const fired =
    cadence === "daily" || cadence === "etf"
      ? recentlyFired(item.lastEvent, today)
      : item.lastEvent !== null && item.lastEvent === item.barDate;
  let recoverBadge: LandmarkRecoverBadge | null = null;
  if (item.recover) {
    if (recentlyFired(item.recover.lastEvent, today)) recoverBadge = "fired";
    else if (item.recover.state === "waiting_premise") recoverBadge = "waitingPremise";
  }
  return {
    key,
    copyKey,
    item,
    badge: fired ? "fired" : STATE_BADGE[item.state],
    recoverBadge,
    staleEmphasis: cadence === "etf" && daysBetween(item.barDate, today) >= LANDMARK_ETF_STALE_DAYS,
  };
}

/** 6 行固定。data が無い・新鮮な行が 1 つも無いときは null (計器盤ごと出さない)。 */
export function buildLandmarkRows(data: LandmarkMeterData | null, now: Date): LandmarkRow[] | null {
  if (!data) return null;
  const today = jstToday(now);
  const rows = LANDMARK_ROW_KEYS.map((key) => rowFor(key, data, now, today));
  return rows.some((row) => row.item !== null) ? rows : null;
}

/** "2026-10-15" → "10/15" */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** "2026-06-28" → "2026年6月28日" */
export function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}
