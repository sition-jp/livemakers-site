import { z } from "zod";

/**
 * 2026-10-16: 節目の計器盤 (feed 最上位 landmark・core spec 2026-10-16-lvm-landmark-meter-design §4-2)。
 * SDE livemakers_export/export_validator.py の validate_landmark と 1:1。数字は SDE が整形した文字列で、
 * 言葉 (指標名・条件の文・状態の名前) は messages 側に置く。不正なら landmark だけ null (他の窓を巻き込まない)。
 *
 * 2026-10-17: 7・8 行目 (ステーブルコイン総供給の前年比の反転 / 最高更新) と月足 MACD の下抜け (`dead`)
 * (core spec 2026-10-17-lvm-landmark-meter-stablecoin-rows-design)。知らないキーの行は捨てて、知っている行で組む —
 * SDE が行を足しても、サイトが知るまでその行が出ないだけで計器盤は消えない。知っている行の検査は緩めない。
 *
 * 2026-10-17 夜: 7 行目に ETH 現物 ETF の累計純流入の最高更新 (`eth_etf_cum_high`・BTC の ETF と同じ形)
 * (core spec 2026-10-17-lvm-landmark-meter-eth-etf-row-design)。ステーブルコインの 2 行は 8・9 行目へ。
 */
export const LANDMARK_ROW_KEYS = [
  "btc_below_200wma",
  "btc_macd_2w_golden_below_zero",
  "btc_macd_1m_golden_cross",
  "btc_mvrv_1",
  "btc_funding_30d_negative",
  "btc_etf_cum_high",
  "eth_etf_cum_high",
  "stablecoin_supply_yoy_flip",
  "stablecoin_supply_ath",
] as const;

export type LandmarkRowKey = (typeof LANDMARK_ROW_KEYS)[number];
export type LandmarkState = "armed" | "cooldown" | "after_cross" | "above_zero";

const ROW_STATES: Record<LandmarkRowKey, readonly LandmarkState[]> = {
  btc_below_200wma: ["armed", "cooldown"],
  btc_macd_2w_golden_below_zero: ["armed", "after_cross", "above_zero"],
  btc_macd_1m_golden_cross: ["armed", "after_cross"],
  btc_mvrv_1: ["armed", "cooldown"],
  btc_funding_30d_negative: ["armed", "cooldown"],
  btc_etf_cum_high: ["armed", "cooldown"],
  eth_etf_cum_high: ["armed", "cooldown"],
  stablecoin_supply_yoy_flip: ["armed", "cooldown"],
  stablecoin_supply_ath: ["armed", "cooldown"],
};

const VALUE_KEYS: Record<LandmarkRowKey, readonly string[]> = {
  btc_below_200wma: ["close", "ma", "gapPct"],
  btc_macd_2w_golden_below_zero: ["macd", "signal", "diff"],
  btc_macd_1m_golden_cross: ["macd", "signal", "diff"],
  btc_mvrv_1: ["mvrv", "realizedPrice", "gap"],
  btc_funding_30d_negative: ["avg30Pct"],
  btc_etf_cum_high: ["cum", "peak", "toPeak", "peakDate"],
  eth_etf_cum_high: ["cum", "peak", "toPeak", "peakDate"],
  stablecoin_supply_yoy_flip: ["yoyPct", "supply"],
  stablecoin_supply_ath: ["supply", "peak", "toPeak", "peakDate"],
};

/** 下抜けを持つ行 (任意) と、点灯の向きを持つ行 (必須) */
const DEAD_ROW: LandmarkRowKey = "btc_macd_1m_golden_cross";
const DIRECTION_ROW: LandmarkRowKey = "stablecoin_supply_yoy_flip";
/** 知らないキーの行を捨てる前の配列の上限 */
const RAW_ITEMS_MAX = 32;

const DATE_VALUES = new Set(["peakDate"]);

/**
 * 2026-10-18: 推移グラフの系列 (行に任意の series・core spec 2026-10-17-lvm-landmark-meter-sparkline-design §5-4)。
 * SDE export_validator.validate_landmark_series と 1:1。崩れていれば series だけ捨てて行は出す。
 * ETF と総供給の行は点灯の線の代わりに「それまでの最高」(peak)。2 週足だけゼロ線の上の足 (aboveZero) を持てる
 */
export const LANDMARK_SERIES_PEAK_ROWS: ReadonlySet<LandmarkRowKey> = new Set([
  "btc_etf_cum_high",
  "eth_etf_cum_high",
  "stablecoin_supply_ath",
]);
const ABOVE_ZERO_ROW: LandmarkRowKey = "btc_macd_2w_golden_below_zero";
/** MACD の行は棒を 0 の線から伸ばすので、点灯の線は 0 だけ */
const ZERO_REF_ROWS: ReadonlySet<LandmarkRowKey> = new Set([
  "btc_macd_2w_golden_below_zero",
  "btc_macd_1m_golden_cross",
]);
const SERIES_WINDOW_DAYS = 730;
const SERIES_MAX_POINTS = 140;
const SERIES_MAX_EVENTS = 12;
const NUMBER_RE = /^[+-]?\d{1,3}(,\d{3})*(\.\d+)?%?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JST_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isoDate = z.string().refine(isIsoDate, "ISO date");
const jstTimestamp = z.string().regex(JST_TIMESTAMP_RE);
const plainInt = z.number().int();
const finiteNumber = z.number().finite();
const seriesPoint = z.tuple([isoDate, finiteNumber]);

const seriesSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    points: z.array(seriesPoint).min(1).max(SERIES_MAX_POINTS),
    events: z.array(isoDate).max(SERIES_MAX_EVENTS),
    ref: finiteNumber.optional(),
    peak: z.array(seriesPoint).optional(),
    aboveZero: z.array(isoDate).optional(),
  })
  .strict();

const DAY_MS = 86_400_000;

function ascending(days: readonly string[]): boolean {
  return days.every((day, index) => index === 0 || days[index - 1] < day);
}

/** 行のキーと足の日付に照らした系列の決まり (SDE の _validate_landmark_series と同じ順に見る) */
function seriesFitsRow(key: LandmarkRowKey, barDate: string, series: z.infer<typeof seriesSchema>): boolean {
  const peakRow = LANDMARK_SERIES_PEAK_ROWS.has(key);
  if (peakRow ? series.peak === undefined || series.ref !== undefined : series.ref === undefined || series.peak !== undefined) {
    return false;
  }
  if (ZERO_REF_ROWS.has(key) && series.ref !== 0) return false;
  if (series.aboveZero !== undefined && key !== ABOVE_ZERO_ROW) return false;
  const span = (Date.parse(`${series.to}T00:00:00Z`) - Date.parse(`${series.from}T00:00:00Z`)) / DAY_MS;
  if (span !== SERIES_WINDOW_DAYS) return false;
  const days = series.points.map(([day]) => day);
  if (!ascending(days) || days[0] < series.from || days.at(-1)! > series.to || days.at(-1) !== barDate) return false;
  if (series.peak) {
    const peak = series.peak;
    if (peak.length !== days.length || peak.some(([day], index) => day !== days[index])) return false;
    if (peak.some(([, high], index) => high < series.points[index][1])) return false;
    if (peak.some(([, high], index) => index > 0 && high < peak[index - 1][1])) return false;
  }
  if (!ascending(series.events) || series.events.some((day) => day < series.from || day > series.to)) return false;
  if (series.aboveZero) {
    const known = new Set(days);
    if (!ascending(series.aboveZero) || series.aboveZero.some((day) => !known.has(day))) return false;
  }
  return true;
}

function parseSeries(key: LandmarkRowKey, barDate: string, raw: unknown): LandmarkSeries | null {
  const parsed = seriesSchema.safeParse(raw);
  if (!parsed.success || !seriesFitsRow(key, barDate, parsed.data)) return null;
  return parsed.data;
}

const recoverSchema = z
  .object({
    state: z.enum(["armed", "waiting_premise"]),
    lastEvent: isoDate.nullable(),
    count: plainInt,
  })
  .strict();

const deadSchema = z
  .object({
    state: z.enum(["armed", "after_cross"]),
    lastEvent: isoDate.nullable(),
    count: plainInt,
  })
  .strict();

const itemSchema = z
  .object({
    key: z.enum(LANDMARK_ROW_KEYS),
    checkedAtJst: jstTimestamp,
    barDate: isoDate,
    nextCheck: isoDate.nullable(),
    state: z.enum(["armed", "cooldown", "after_cross", "above_zero"]),
    eligibleFrom: isoDate.nullable(),
    lastEvent: isoDate.nullable(),
    lastDirection: z.enum(["positive", "negative"]).nullable().optional(),
    count: plainInt,
    sinceYear: plainInt,
    values: z.record(z.string(), z.string()),
    recover: recoverSchema.optional(),
    dead: deadSchema.optional(),
    // 中身は parseSeries で別に見る (崩れていても行は落とさない)
    series: z.unknown().optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (!ROW_STATES[item.key].includes(item.state)) fail("state not allowed for key");
    if ((item.state === "cooldown") !== (item.eligibleFrom !== null)) fail("eligibleFrom is for cooldown only");
    if ((item.key === "btc_mvrv_1") !== (item.recover !== undefined)) fail("recover is for btc_mvrv_1 only");
    if ((item.key === DIRECTION_ROW) !== (item.lastDirection !== undefined)) fail("lastDirection is for the yoy row only");
    if (item.dead !== undefined && item.key !== DEAD_ROW) fail("dead is for the monthly MACD row only");
    const expected = VALUE_KEYS[item.key];
    const actual = Object.keys(item.values);
    if (actual.length !== expected.length || !expected.every((name) => name in item.values)) {
      fail("values keys mismatch");
      return;
    }
    for (const [name, value] of Object.entries(item.values)) {
      const ok = DATE_VALUES.has(name) ? isIsoDate(value) : NUMBER_RE.test(value);
      if (!ok) fail(`bad value ${name}`);
    }
  });

function isKnownRow(item: unknown): boolean {
  if (typeof item !== "object" || item === null) return false;
  const key = (item as { key?: unknown }).key;
  return typeof key === "string" && (LANDMARK_ROW_KEYS as readonly string[]).includes(key);
}

const landmarkSchema = z
  .object({
    schemaVersion: z.literal("livemakers_landmark_v0.1"),
    generatedAtJst: jstTimestamp,
    items: z
      .array(z.unknown())
      .max(RAW_ITEMS_MAX)
      .transform((items) => items.filter(isKnownRow))
      .pipe(z.array(itemSchema).min(1).max(LANDMARK_ROW_KEYS.length)),
  })
  .strict()
  .superRefine((section, ctx) => {
    const keys = new Set(section.items.map((item) => item.key));
    if (keys.size !== section.items.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate key" });
    }
  });

export interface LandmarkRecover {
  state: "armed" | "waiting_premise";
  lastEvent: string | null;
  count: number;
}

export interface LandmarkDead {
  state: "armed" | "after_cross";
  lastEvent: string | null;
  count: number;
}

/** 推移グラフの系列 (過去 2 年・SDE が窓で切ったもの) */
export interface LandmarkSeries {
  from: string;
  to: string;
  /** [ISO 日付, 値] の古い順・最後 = barDate */
  points: [string, number][];
  /** 窓内の過去の点灯日 */
  events: string[];
  /** 点灯の線の値 (ETF と総供給の行には無い) */
  ref?: number;
  /** ETF と総供給の行だけ: それまでの最高 (points と同じ日付) */
  peak?: [string, number][];
  /** 2 週足 MACD だけ: MACD がゼロ線の上にあった足 */
  aboveZero?: string[];
}

export interface LandmarkItem {
  key: LandmarkRowKey;
  checkedAtJst: string;
  barDate: string;
  nextCheck: string | null;
  state: LandmarkState;
  eligibleFrom: string | null;
  lastEvent: string | null;
  /** stablecoin_supply_yoy_flip だけ: 前回の点灯の向き */
  lastDirection?: "positive" | "negative" | null;
  count: number;
  sinceYear: number;
  values: Record<string, string>;
  recover?: LandmarkRecover;
  /** btc_macd_1m_golden_cross だけ (任意): 月足の下抜け */
  dead?: LandmarkDead;
  /** 推移グラフの系列 (任意・崩れていれば付かない) */
  series?: LandmarkSeries;
}

export interface LandmarkMeterData {
  generatedAtJst: string;
  items: LandmarkItem[];
}

export function mapLandmarkMeter(section: unknown): LandmarkMeterData | null {
  const parsed = landmarkSchema.safeParse(section);
  if (!parsed.success) return null;
  const items = parsed.data.items.map(({ series: rawSeries, ...item }): LandmarkItem => {
    if (rawSeries === undefined) return item;
    const series = parseSeries(item.key, item.barDate, rawSeries);
    return series ? { ...item, series } : item;
  });
  return { generatedAtJst: parsed.data.generatedAtJst, items };
}
