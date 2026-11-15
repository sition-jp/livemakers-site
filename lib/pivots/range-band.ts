/**
 * 「ふだんの揺れ幅」の帯の図の座標・凡例・表・計算の手順の数字 (TP 表示 v2・Task 10)。
 * 描画も i18n も持たない純関数 (probability-timeline.ts と同じ形)。viewBox は試作 340×222 と同じ。
 * 値段の目盛りは 1 つの scale (scaleY) で、線・箱・点線・ラベルのすべてを描く。
 * 帯は今日の右にだけある (過去の線は今日の点で止まる)。7 日の箱は 7 日分・30 日の箱は 30 日分の幅。
 */
import { formatPrice } from "./forecast";
import { tenScale } from "./regime";
import type { RangeBand } from "./types";

export type RangeBandOne = NonNullable<RangeBand[keyof RangeBand]>;
type Item = RangeBandOne["items"][number];

const PAST_DAYS = 60;
const FUTURE_DAYS = 30;
const STEP = 2.8;

export const RANGE_BAND_LAYOUT = {
  width: 340,
  height: 222,
  left: 6,
  step: STEP,
  todayX: 6 + PAST_DAYS * STEP, // 174
  futureRight: 6 + (PAST_DAYS + FUTURE_DAYS) * STEP, // 258
  labelX: 265,
  plotTop: 14,
  plotBottom: 192,
  axisLabelY: 208,
  captionY: 11,
  /** 値段の目盛りの上下の余白 (文字がはみ出さないように)。 */
  scalePad: 8,
} as const;
const L = RANGE_BAND_LAYOUT;

export interface Point {
  x: number;
  y: number;
}
export interface BandBox {
  id: "b7" | "b30";
  x: number;
  y: number;
  width: number;
  height: number;
  lo: number;
  hi: number;
}
export interface BandLead {
  id: "now" | "hi7" | "lo7";
  x1: number;
  x2: number;
  y: number;
  value: number;
}
export interface BandLabel {
  id: "hi30" | "hi7" | "now" | "lo7" | "lo30";
  value: number;
  text: string;
  x: number;
  /** 線の高さ (箱の縁・今日の点と同じ)。 */
  y: number;
  /** 文字の基準線 (y + 3.5)。 */
  textY: number;
}
export interface AxisTick {
  kind: "start" | "mid" | "today" | "end";
  x: number;
  /** start / mid だけ ISO の日付 (そろっていないときは null)。 */
  date: string | null;
  anchor: "start" | "middle" | "end";
}

function edges(band: RangeBandOne, id: "either7" | "either30") {
  const it = band.items.find((i) => i.id === id);
  if (!it) return null;
  return {
    lo: it.lo ?? band.close * (1 - it.threshold),
    hi: it.hi ?? band.close * (1 + it.threshold),
  };
}

export function buildRangeBand(history: { date: string; close: number }[], band: RangeBandOne) {
  let past = history.slice(-(PAST_DAYS + 1));
  // 履歴の最後が基準日より前なら、基準日の終値の点を足して線が今日の点で止まるようにする
  if (past.length > 0 && past[past.length - 1].date < band.as_of) {
    past = [...past, { date: band.as_of, close: band.close }].slice(-(PAST_DAYS + 1));
  }
  const e7 = edges(band, "either7");
  const e30 = edges(band, "either30");

  const values = [...past.map((p) => p.close), band.close];
  if (e7) values.push(e7.lo, e7.hi);
  if (e30) values.push(e30.lo, e30.hi);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const top = L.plotTop + L.scalePad;
  const bottom = L.plotBottom - L.scalePad;
  const span = max - min || 1;
  const scaleY = (v: number) => top + ((max - v) / span) * (bottom - top);

  const n = past.length;
  const price: Point[] = past.map((p, i) => ({ x: L.todayX - (n - 1 - i) * STEP, y: scaleY(p.close) }));

  const bands: BandBox[] = [];
  const box = (id: "b7" | "b30", e: { lo: number; hi: number } | null, days: number) => {
    if (!e) return;
    const y = scaleY(e.hi);
    bands.push({ id, x: L.todayX, y, width: days * STEP, height: scaleY(e.lo) - y, lo: e.lo, hi: e.hi });
  };
  box("b30", e30, 30);
  box("b7", e7, 7);

  const todayY = scaleY(band.close);
  const todayDot = { x: L.todayX, y: todayY };
  const leadEnd = L.labelX - 3;
  const leads: BandLead[] = [{ id: "now", x1: L.todayX, x2: leadEnd, y: todayY, value: band.close }];
  if (e7) {
    const x1 = L.todayX + 7 * STEP;
    leads.push({ id: "hi7", x1, x2: leadEnd, y: scaleY(e7.hi), value: e7.hi });
    leads.push({ id: "lo7", x1, x2: leadEnd, y: scaleY(e7.lo), value: e7.lo });
  }

  const labels: BandLabel[] = [];
  const label = (id: BandLabel["id"], value: number) =>
    labels.push({ id, value, text: formatPrice(value), x: L.labelX, y: scaleY(value), textY: scaleY(value) + 3.5 });
  if (e30) label("hi30", e30.hi);
  if (e7) label("hi7", e7.hi);
  label("now", band.close);
  if (e7) label("lo7", e7.lo);
  if (e30) label("lo30", e30.lo);

  const midIdx = Math.floor((n - 1) / 2);
  const axis = {
    y: L.plotBottom,
    x1: L.left,
    x2: L.futureRight,
    labelY: L.axisLabelY,
    ticks: [
      { kind: "start", x: price[0]?.x ?? L.left, date: past[0]?.date ?? null, anchor: "start" },
      { kind: "mid", x: price[midIdx]?.x ?? L.todayX, date: past[midIdx]?.date ?? null, anchor: "middle" },
      { kind: "today", x: L.todayX, date: null, anchor: "middle" },
      { kind: "end", x: L.futureRight, date: null, anchor: "end" },
    ] as AxisTick[],
  };

  return {
    scaleY,
    lines: {
      price,
      today: { x: L.todayX, y1: L.plotTop, y2: L.plotBottom },
      leads,
    },
    futureBox: { x: L.todayX, y: L.plotTop, width: FUTURE_DAYS * STEP, height: L.plotBottom - L.plotTop },
    bands,
    todayDot,
    labels,
    axis,
  };
}

/** 文に出す小数 1 桁の % (文字列。2.0 を "2" にしない)。 */
const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const widthPct1 = (threshold: number) => fmt1(threshold * 100);

/** 文に出す数はすべて整形済みの文字列 (価格 = formatPrice・% = 小数 1 桁)。メッセージは {x} をそのまま使う。 */
export interface LegendItem {
  id: "b7" | "b30";
  days: 7 | 30;
  lo: string;
  hi: string;
  /** ± の % (小数 1 桁・しきい値 × 100)。 */
  widthPct: string;
  usualPct: number;
  tenN: number;
}

export function legendItems(band: RangeBandOne): LegendItem[] {
  const out: LegendItem[] = [];
  for (const [item, id] of [
    ["either7", "b7"],
    ["either30", "b30"],
  ] as const) {
    const it = band.items.find((i) => i.id === item);
    const e = edges(band, item);
    if (!it || !e) continue;
    out.push({
      id,
      days: id === "b7" ? 7 : 30,
      lo: formatPrice(e.lo),
      hi: formatPrice(e.hi),
      widthPct: widthPct1(it.threshold),
      usualPct: Math.round(it.usual_pct),
      tenN: tenScale(it.usual_pct),
    });
  }
  return out;
}

export interface UpDownRow {
  id: "up7" | "down7" | "up30" | "down30";
  side: "up" | "down";
  horizonDays: number;
  widthPct: string;
  /** 上の線 / 下の線の値段 (formatPrice)。 */
  price: string;
  usualPct: number;
  tenN: number;
}

export function upDownRows(band: RangeBandOne): UpDownRow[] {
  const rows: UpDownRow[] = [];
  for (const id of ["up7", "down7", "up30", "down30"] as const) {
    const it: Item | undefined = band.items.find((i) => i.id === id);
    if (!it || (it.side !== "up" && it.side !== "down")) continue;
    const price =
      it.side === "up"
        ? (it.hi ?? band.close * (1 + it.threshold))
        : (it.lo ?? band.close * (1 - it.threshold));
    rows.push({
      id,
      side: it.side,
      horizonDays: it.horizon_days,
      widthPct: widthPct1(it.threshold),
      price: formatPrice(price),
      usualPct: Math.round(it.usual_pct),
      tenN: tenScale(it.usual_pct),
    });
  }
  return rows;
}

/** 「今日の数字で読むと」(§4.5) の 1〜5 の値。7 日の幅の手順。メッセージが使う名前の平らな文字列・整数。 */
export function workedExample(band: RangeBandOne, asset: string, closeDate: string) {
  const it = band.items.find((i) => i.id === "either7");
  const e = edges(band, "either7");
  if (!it || !e) throw new Error("either7 item missing");
  const tenN = tenScale(it.usual_pct);
  return {
    asset,
    closeDate,
    closeMonth: Number(closeDate.split("-")[1]),
    closeDay: Number(closeDate.split("-")[2]),
    close: formatPrice(band.close),
    dailyPct: fmt1((band.realized_vol_30d / Math.sqrt(365)) * 100),
    annualPct: Math.round(band.realized_vol_30d * 100),
    sqrtN: fmt1(Math.sqrt(it.horizon_days)),
    k: it.k,
    widthPct: widthPct1(it.threshold),
    lo: formatPrice(e.lo),
    hi: formatPrice(e.hi),
    usualPct: Math.round(it.usual_pct),
    tenN,
    restN: 10 - tenN,
    minPct: fmt1(band.threshold_7d_365.min * 100),
    maxPct: fmt1(band.threshold_7d_365.max * 100),
    position: band.threshold_7d_365.position,
  };
}
