import { z } from "zod";

/**
 * 2026-10-16: 節目の計器盤 (feed 最上位 landmark・core spec 2026-10-16-lvm-landmark-meter-design §4-2)。
 * SDE livemakers_export/export_validator.py の validate_landmark と 1:1。数字は SDE が整形した文字列で、
 * 言葉 (指標名・条件の文・状態の名前) は messages 側に置く。不正なら landmark だけ null (他の窓を巻き込まない)。
 */
export const LANDMARK_ROW_KEYS = [
  "btc_below_200wma",
  "btc_macd_2w_golden_below_zero",
  "btc_macd_1m_golden_cross",
  "btc_mvrv_1",
  "btc_funding_30d_negative",
  "btc_etf_cum_high",
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
};

const VALUE_KEYS: Record<LandmarkRowKey, readonly string[]> = {
  btc_below_200wma: ["close", "ma", "gapPct"],
  btc_macd_2w_golden_below_zero: ["macd", "signal", "diff"],
  btc_macd_1m_golden_cross: ["macd", "signal", "diff"],
  btc_mvrv_1: ["mvrv", "realizedPrice", "gap"],
  btc_funding_30d_negative: ["avg30Pct"],
  btc_etf_cum_high: ["cum", "peak", "toPeak", "peakDate"],
};

const DATE_VALUES = new Set(["peakDate"]);
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

const recoverSchema = z
  .object({
    state: z.enum(["armed", "waiting_premise"]),
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
    count: plainInt,
    sinceYear: plainInt,
    values: z.record(z.string(), z.string()),
    recover: recoverSchema.optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (!ROW_STATES[item.key].includes(item.state)) fail("state not allowed for key");
    if ((item.state === "cooldown") !== (item.eligibleFrom !== null)) fail("eligibleFrom is for cooldown only");
    if ((item.key === "btc_mvrv_1") !== (item.recover !== undefined)) fail("recover is for btc_mvrv_1 only");
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

const landmarkSchema = z
  .object({
    schemaVersion: z.literal("livemakers_landmark_v0.1"),
    generatedAtJst: jstTimestamp,
    items: z.array(itemSchema).min(1).max(LANDMARK_ROW_KEYS.length),
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

export interface LandmarkItem {
  key: LandmarkRowKey;
  checkedAtJst: string;
  barDate: string;
  nextCheck: string | null;
  state: LandmarkState;
  eligibleFrom: string | null;
  lastEvent: string | null;
  count: number;
  sinceYear: number;
  values: Record<string, string>;
  recover?: LandmarkRecover;
}

export interface LandmarkMeterData {
  generatedAtJst: string;
  items: LandmarkItem[];
}

export function mapLandmarkMeter(section: unknown): LandmarkMeterData | null {
  const parsed = landmarkSchema.safeParse(section);
  if (!parsed.success) return null;
  return { generatedAtJst: parsed.data.generatedAtJst, items: parsed.data.items };
}
