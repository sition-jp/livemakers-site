/**
 * Daily probability bar chart — pure coordinate model (it-2026-10 stage 3, Task 13a).
 *
 * Renders no markup and knows no i18n. One calendar day = one equal-width slot
 * across [left, right]; the slots cover the shown past days plus `futureDays`.
 * The past panel is a price line (top band) over daily probability bars
 * (bottom band); the future is an empty band after today's slot.
 * Dates are returned as given (ISO YYYY-MM-DD, UTC daily bars) — no tz conversion.
 */
import type { ForecastHistoryEntry, Horizon, TurnEntry } from "./types";

export const PROBABILITY_LAYOUT = {
  width: 760,
  height: 350,
  left: 40,
  right: 720,
  priceTop: 30,
  priceBottom: 110,
  barTop: 120,
  barBottom: 290,
  tickY: 322,
} as const;

const HORIZON_DAYS: Record<Horizon, number> = { "7D": 7, "30D": 30, "90D": 90 };
const MARKER_SIZE: Record<TurnEntry["strength"], number> = {
  small: 8,
  medium: 11,
  large: 14,
  cycle: 18,
};
/** Distance (SVG units) between the price line and a top/bottom marker centre. */
const MARKER_OFFSET = 8;
const BAR_GAP_RATIO = 0.15;
const MIN_BAR_WIDTH = 0.5;

export type BarStatus = "hit" | "miss" | "pending" | "today";

export interface ProbabilityBar {
  date: string;
  x: number;
  width: number;
  y: number;
  height: number;
  pct: number;
  status: BarStatus;
  backfilled: boolean;
}

export interface ProbabilityGap {
  date: string;
  /** Centre of the day's slot. */
  x: number;
}

export interface ProbabilityMarker {
  date: string;
  kind: TurnEntry["kind"];
  strength: TurnEntry["strength"];
  x: number;
  y: number;
  size: number;
}

export interface ProbabilityTick {
  date: string;
  /** Start of the day's slot. */
  x: number;
  /** M/D, no zero padding. */
  label: string;
}

export interface ProbabilityTimelineInput {
  history: ForecastHistoryEntry[];
  turns: TurnEntry[];
  event: "turn" | "move";
  horizon: Horizon;
  todayPct: number | null;
  usualPct: number | null;
  /** Default = whole history. */
  pastDays?: number;
  /** Default = horizon length in days (7 / 30 / 90). */
  futureDays?: number;
}

export interface ProbabilityTimelineModel {
  bars: ProbabilityBar[];
  gaps: ProbabilityGap[];
  price: { points: [number, number][] } | null;
  markers: ProbabilityMarker[];
  ticks: ProbabilityTick[];
  todayX: number;
  future: {
    x0: number;
    x1: number;
    endDate: string;
    todayPct: number | null;
    usualPct: number | null;
  };
  usualY: number | null;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
  );
}

function isMonday(iso: string): boolean {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 1;
}

function mdLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}

export function buildProbabilityTimeline(
  input: ProbabilityTimelineInput,
): ProbabilityTimelineModel {
  const L = PROBABILITY_LAYOUT;
  const { event, horizon } = input;
  const all = input.history;
  const todayDate = all.length > 0 ? all[all.length - 1].date : "";
  // pastDays = calendar days back from today (entries older than that are dropped).
  const firstDate =
    all.length === 0
      ? ""
      : input.pastDays !== undefined
        ? addDays(todayDate, -(Math.max(1, input.pastDays) - 1))
        : all[0].date;
  const shown = all.filter((e) => e.date >= firstDate);
  const futureDays = input.futureDays ?? HORIZON_DAYS[horizon];
  const pastSlots = all.length === 0 ? 0 : dayDiff(firstDate, todayDate) + 1;
  const totalSlots = Math.max(1, pastSlots + futureDays);
  const slot = (L.right - L.left) / totalSlots;
  const slotStart = (i: number) => L.left + i * slot;
  const slotCenter = (i: number) => L.left + (i + 0.5) * slot;
  const barGap = Math.max(slot * BAR_GAP_RATIO, 0);
  const barWidth = Math.max(slot - barGap, MIN_BAR_WIDTH);
  const barBand = L.barBottom - L.barTop;
  const slotOf = (date: string) => dayDiff(firstDate, date);

  const bars: ProbabilityBar[] = [];
  const gaps: ProbabilityGap[] = [];
  shown.forEach((e) => {
    const i = slotOf(e.date);
    const pct = e.forecast?.[event]?.[horizon];
    if (pct === undefined) {
      gaps.push({ date: e.date, x: slotCenter(i) });
      return;
    }
    const height = (pct / 100) * barBand;
    const status: BarStatus =
      e.date === todayDate ? "today" : (e.outcome?.[event]?.[horizon] ?? "pending");
    bars.push({
      date: e.date,
      x: slotStart(i) + barGap / 2,
      width: barWidth,
      y: L.barBottom - height,
      height,
      pct,
      status,
      backfilled: e.backfilled,
    });
  });

  // Price line: only days with a close; needs at least 2.
  const closes = shown
    .map((e) => ({ i: slotOf(e.date), date: e.date, close: e.close }))
    .filter((p): p is { i: number; date: string; close: number } => p.close !== undefined);
  let price: ProbabilityTimelineModel["price"] = null;
  const yByDate = new Map<string, number>();
  const xByDate = new Map<string, number>();
  if (closes.length >= 2) {
    const lo = Math.min(...closes.map((p) => p.close));
    const hi = Math.max(...closes.map((p) => p.close));
    const bandH = L.priceBottom - L.priceTop;
    const points: [number, number][] = closes.map((p) => {
      const x = slotCenter(p.i);
      const y =
        hi === lo
          ? (L.priceTop + L.priceBottom) / 2
          : L.priceBottom - ((p.close - lo) / (hi - lo)) * bandH;
      yByDate.set(p.date, y);
      xByDate.set(p.date, x);
      return [x, y];
    });
    price = { points };
  }

  // Markers sit on the price point of their own date. A turn dated on a day
  // with no close (or when there is no price line) is skipped, not interpolated.
  const markers: ProbabilityMarker[] = [];
  for (const t of input.turns) {
    const py = yByDate.get(t.date);
    const px = xByDate.get(t.date);
    if (py === undefined || px === undefined) continue;
    markers.push({
      date: t.date,
      kind: t.kind,
      strength: t.strength,
      x: px,
      y: t.kind === "top" ? py - MARKER_OFFSET : py + MARKER_OFFSET,
      size: MARKER_SIZE[t.strength],
    });
  }
  markers.sort((a, b) => a.x - b.x);

  const ticks: ProbabilityTick[] = [];
  if (all.length > 0) {
    const first = firstDate;
    for (let i = 0; i < totalSlots; i++) {
      const date = addDays(first, i);
      if (isMonday(date)) ticks.push({ date, x: slotStart(i), label: mdLabel(date) });
    }
  }

  const usualY =
    input.usualPct === null
      ? null
      : L.barBottom - (input.usualPct / 100) * barBand;

  return {
    bars,
    gaps,
    price,
    markers,
    ticks,
    todayX: all.length > 0 ? slotCenter(pastSlots - 1) : L.left,
    future: {
      x0: slotStart(pastSlots),
      x1: L.right,
      endDate: todayDate ? addDays(todayDate, futureDays) : "",
      todayPct: input.todayPct,
      usualPct: input.usualPct,
    },
    usualY,
  };
}
