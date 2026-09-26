/**
 * Turning-point timeline — pure coordinate model (spec 2026-09-26 §3.6 T1-T6, §5.8 T-U1).
 *
 * Renders no markup and knows no i18n. It turns a snapshot's rolling
 * `history` (read at the selected horizon for the past panel), each
 * horizon's own current scores/direction bias (for the three forward
 * windows — T2: each window is shaded and leaned by ITS OWN horizon, not
 * the selected one), and backtest lead-time metrics into SVG coordinates
 * the component can draw. Wording lives entirely in the component + i18n
 * layer so this file can never assert a direction — it only emits numbers
 * and an "up"/"down" lean flag that the caller labels.
 */
import { DIRECTION_GAP } from "./describe";
import { scoreLevel } from "./types";
import type {
  AssetSymbol,
  BacktestEntry,
  DirectionBias,
  HistoryEntry,
  Horizon,
  RadarScores,
  ScoreLevel,
  ScoreType,
} from "./types";

export const TIMELINE_LAYOUT = {
  baseWidth: 680,
  pastXStart: 48,
  todayX: 417,
  futureXEnd: 640,
  priceYTop: 50,
  priceYBottom: 180,
  stripYTop: 196,
  stripYBottom: 214,
  windowYStart: 240,
  windowHeight: 38,
  windowPitch: 58,
  legendY: 440,
  viewBoxHeight: 500,
} as const;

const MAX_HISTORY_DAYS = 120;
const MARKER_THRESHOLD = 40;
const STRONG_THRESHOLD = 70;
const TICK_THRESHOLD = 70;
const WEAK_SAMPLE_SIZE = 5;

const HORIZONS: Horizon[] = ["7D", "30D", "90D"];
const HORIZON_DAYS: Record<Horizon, number> = { "7D": 7, "30D": 30, "90D": 90 };
const TICK_SCORE_TYPES: ScoreType[] = ["price_pivot", "volatility_pivot"];

export interface TimelinePoint {
  x: number;
  y: number;
}

export interface TimelineStripCell {
  x: number;
  opacity: number;
}

export interface TimelineMarker {
  x: number;
  y: number;
  strong: boolean;
  date: string;
}

export interface TimelineExample {
  fromX: number;
  toX: number;
  y: number;
  /** Date of the originating marker (the "date" in "{date} score {score} → …"). */
  date: string;
  /** Rounded overall score at the marker date, for the selected horizon. */
  score: number;
  /** Horizon length in days (the "H" the close is compared H days later). */
  days: number;
  /** Realised percentage move from the marker's close to the close H days later. */
  movePct: number;
}

export interface TimelinePast {
  points: TimelinePoint[];
  strip: TimelineStripCell[];
  markers: TimelineMarker[];
  example: TimelineExample | null;
}

export interface TimelineTick {
  x: number;
  scoreType: ScoreType;
  days: number;
  n: number;
  weak: boolean;
}

export interface TimelineWindow {
  horizon: Horizon;
  x: number;
  width: number;
  opacity: number;
  level: ScoreLevel;
  lean: "up" | "down" | null;
  ticks: TimelineTick[];
}

export interface TimelineModel {
  xOfDate(d: string): number;
  today: number;
  past: TimelinePast | null;
  windows: TimelineWindow[];
  viewBoxHeight: number;
}

export interface TimelineInput {
  asset: AssetSymbol;
  /** YYYY-MM-DD, the snapshot's generated_at date. */
  today: string;
  /** Selected horizon — drives the past panel only (markers/strip/example). */
  horizon: Horizon;
  /** Each horizon's own current scores — drives that window's opacity/level (T2). */
  currentByHorizon: Record<Horizon, RadarScores>;
  /** Each horizon's own direction bias — drives that window's lean (T2). */
  biasByHorizon: Partial<Record<Horizon, DirectionBias | null>>;
  history: HistoryEntry[] | null;
  backtest: BacktestEntry[];
  /** SVG viewBox width; layout constants scale to this. Default 680. */
  width?: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** Sort ascending by date and keep only the most recent MAX_HISTORY_DAYS entries. */
function normalizeHistory(history: HistoryEntry[] | null): HistoryEntry[] {
  if (!history || history.length === 0) return [];
  return [...history].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_HISTORY_DAYS);
}

function computeLean(level: ScoreLevel, bias: DirectionBias | null): "up" | "down" | null {
  if (level === "Low" || !bias) return null;
  const gap = bias.bullish - bias.bearish;
  if (Math.abs(gap) < DIRECTION_GAP) return null;
  return gap > 0 ? "up" : "down";
}

function buildTicks(
  backtest: BacktestEntry[],
  asset: AssetSymbol,
  horizon: Horizon,
  x: number,
  width: number,
): TimelineTick[] {
  const days = HORIZON_DAYS[horizon];
  const ticks: TimelineTick[] = [];
  for (const scoreType of TICK_SCORE_TYPES) {
    const match = backtest.find(
      (e) =>
        e.asset === asset &&
        e.horizon === horizon &&
        e.score_type === scoreType &&
        e.threshold === TICK_THRESHOLD,
    );
    if (!match || match.metrics.sample_size <= 0) continue;
    const lead = match.metrics.avg_lead_time_days;
    const frac = days > 0 ? clamp01(lead / days) : 0;
    ticks.push({
      x: x + frac * width,
      scoreType,
      days: lead,
      n: match.metrics.sample_size,
      weak: match.metrics.sample_size < WEAK_SAMPLE_SIZE,
    });
  }
  return ticks;
}

function buildExample(
  entries: HistoryEntry[],
  horizon: Horizon,
  markers: TimelineMarker[],
  xOfDate: (d: string) => number,
): TimelineExample | null {
  if (markers.length === 0) return null;
  const strong = markers.filter((m) => m.strong);
  // Latest (most recent) strong marker; markers is already date-ascending.
  const candidateMarker = strong.length > 0 ? strong[strong.length - 1] : markers[0];
  const fromEntry = entries.find((e) => e.date === candidateMarker.date);
  if (!fromEntry) return null;

  const days = HORIZON_DAYS[horizon];
  const targetDate = addDaysISO(candidateMarker.date, days);
  const targetEntry = entries.find((e) => e.date === targetDate);
  if (!targetEntry) return null;

  const movePct = ((targetEntry.close - fromEntry.close) / fromEntry.close) * 100;

  return {
    fromX: candidateMarker.x,
    toX: xOfDate(targetDate),
    y: TIMELINE_LAYOUT.priceYTop + 12,
    date: candidateMarker.date,
    score: Math.round(fromEntry.overall[horizon]),
    days,
    movePct,
  };
}

export function buildTimelineModel(input: TimelineInput): TimelineModel {
  const width = input.width ?? TIMELINE_LAYOUT.baseWidth;
  const scale = width / TIMELINE_LAYOUT.baseWidth;
  const pastXStart = TIMELINE_LAYOUT.pastXStart * scale;
  const todayX = TIMELINE_LAYOUT.todayX * scale;
  const futureXEnd = TIMELINE_LAYOUT.futureXEnd * scale;

  const entries = normalizeHistory(input.history);
  const dateIndex = new Map(entries.map((e, i) => [e.date, i]));
  const closes = entries.map((e) => e.close);
  const min = closes.length ? Math.min(...closes) : 0;
  const max = closes.length ? Math.max(...closes) : 0;
  const range = Math.max(max - min, Number.EPSILON);

  const xAtIndex = (i: number): number =>
    entries.length <= 1 ? todayX : pastXStart + (i / (entries.length - 1)) * (todayX - pastXStart);
  const yAtClose = (close: number): number =>
    TIMELINE_LAYOUT.priceYBottom -
    ((close - min) / range) * (TIMELINE_LAYOUT.priceYBottom - TIMELINE_LAYOUT.priceYTop);

  const xOfDate = (date: string): number => {
    const idx = dateIndex.get(date);
    if (idx !== undefined) return xAtIndex(idx);
    if (entries.length === 0) return todayX;
    const first = entries[0].date;
    const totalDays = Math.max(1, daysBetweenISO(first, input.today));
    const offset = daysBetweenISO(first, date);
    const frac = clamp01(offset / totalDays);
    return pastXStart + frac * (todayX - pastXStart);
  };

  let past: TimelinePast | null = null;
  if (entries.length > 0) {
    const points = entries.map((e, i) => ({ x: xAtIndex(i), y: yAtClose(e.close) }));
    const strip = entries.map((e, i) => ({
      x: xAtIndex(i),
      opacity: clamp01(e.overall[input.horizon] / 100),
    }));
    const markers = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.overall[input.horizon] >= MARKER_THRESHOLD)
      .map(({ e, i }) => ({
        x: xAtIndex(i),
        y: yAtClose(e.close),
        strong: e.overall[input.horizon] >= STRONG_THRESHOLD,
        date: e.date,
      }));
    const example = buildExample(entries, input.horizon, markers, xOfDate);
    past = { points, strip, markers, example };
  }

  const windowX = todayX;
  const windowWidth = futureXEnd - todayX;

  const windows: TimelineWindow[] = HORIZONS.map((horizon) => {
    const scores = input.currentByHorizon[horizon];
    const level = scoreLevel(scores.overall);
    const bias = input.biasByHorizon[horizon] ?? null;
    const lean = computeLean(level, bias);
    const opacity = Math.max(0.12, scores.overall / 100);
    return {
      horizon,
      x: windowX,
      width: windowWidth,
      opacity,
      level,
      lean,
      ticks: buildTicks(input.backtest, input.asset, horizon, windowX, windowWidth),
    };
  });

  return {
    xOfDate,
    today: todayX,
    past,
    windows,
    viewBoxHeight: TIMELINE_LAYOUT.viewBoxHeight,
  };
}
