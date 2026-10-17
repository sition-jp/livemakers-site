import type { LandmarkRowKey, LandmarkSeries } from "@/lib/landmark/meter-feed";

/**
 * 節目の計器盤の推移グラフの座標 (core spec 2026-10-17-lvm-landmark-meter-sparkline-design §6)。
 * 部品 (components/articles/LandmarkSparkline.tsx) は描くだけにして、日付 → x・値 → y の換算はここに置く。
 *
 * - x: from〜to (2 年) を日付の比で置く。全カードで同じ窓なので、縦線の位置をカードをまたいで比べられる
 * - y: その行の値 (と点灯の線・それまでの最高) の最小〜最大に上下 8% の余白。点灯の線のまわりを拡大しない
 * - 色・太さで近い・遠いを表さない (印の種類は「過去」「ゼロ線の上の足」「いま」だけ)
 */
export const SPARK_WIDTH = 300;
export const SPARK_HEIGHT = 48;
const PAD_Y = 4;
const MARGIN = 0.08;
const BAR_MAX_WIDTH = 10;
const BAR_MIN_WIDTH = 2;
const DAY_MS = 86_400_000;

export type SparkKind = "line" | "bars" | "peak";
export type SparkBarTone = "past" | "outside" | "now";

const BAR_ROWS: ReadonlySet<LandmarkRowKey> = new Set([
  "btc_macd_2w_golden_below_zero",
  "btc_macd_1m_golden_cross",
]);

export interface SparkBar {
  x: number;
  y: number;
  width: number;
  height: number;
  /** past = 過去の足 / outside = ゼロ線の上の足 (2 週足・数えない) / now = いまの足 */
  tone: SparkBarTone;
}

export interface SparkGeometry {
  kind: SparkKind;
  /** 推移の線 (polyline の points)。棒の行は null */
  line: string | null;
  /** それまでの最高 (階段)。ETF と総供給の行だけ */
  peak: string | null;
  /** 点灯の線 (と棒の 0 の線) の y。最高を持つ行は null */
  refY: number | null;
  bars: SparkBar[];
  /** 過去の点灯の x */
  events: number[];
  /** いまの点 (折れ線の行)。幅が変わっても丸のままにするため、SVG の外に % で置く */
  now: { leftPct: number; top: number } | null;
  /** 窓の中の 1 月 1 日 */
  ticks: { x: number; leftPct: number; label: string }[];
}

function dayNumber(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sparkKind(key: LandmarkRowKey, series: LandmarkSeries): SparkKind {
  if (series.peak) return "peak";
  return BAR_ROWS.has(key) ? "bars" : "line";
}

export function buildSparkline(key: LandmarkRowKey, series: LandmarkSeries): SparkGeometry {
  const kind = sparkKind(key, series);
  const start = dayNumber(series.from);
  const span = dayNumber(series.to) - start;
  const xOf = (iso: string) => round(((dayNumber(iso) - start) / span) * SPARK_WIDTH);

  const values = [
    ...series.points.map(([, value]) => value),
    ...(series.ref !== undefined ? [series.ref] : []),
    ...(series.peak ?? []).map(([, value]) => value),
  ];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const range = hi - lo || Math.abs(hi) || 1;
  lo -= range * MARGIN;
  hi += range * MARGIN;
  const yOf = (value: number) => round(PAD_Y + ((hi - value) / (hi - lo)) * (SPARK_HEIGHT - 2 * PAD_Y));

  const refY = series.ref !== undefined ? yOf(series.ref) : null;
  const events = series.events.map(xOf);
  const ticks: SparkGeometry["ticks"] = [];
  for (let year = Number(series.from.slice(0, 4)) + 1; year <= Number(series.to.slice(0, 4)); year += 1) {
    const x = xOf(`${year}-01-01`);
    ticks.push({ x, leftPct: round((x / SPARK_WIDTH) * 100), label: String(year) });
  }

  if (kind === "bars") {
    const first = dayNumber(series.points[0][0]);
    const last = dayNumber(series.points.at(-1)![0]);
    const spacing = series.points.length > 1 ? (last - first) / (series.points.length - 1) : 14;
    const width = round(Math.min(BAR_MAX_WIDTH, Math.max(BAR_MIN_WIDTH, (spacing / span) * SPARK_WIDTH - 2)));
    const zero = yOf(0);
    const outside = new Set(series.aboveZero ?? []);
    const bars = series.points.map(([day, value], index): SparkBar => {
      // 棒は必ず 0 の線から伸ばす (ごく小さい棒も最小の高さで 0 の線に付ける)
      const height = round(Math.max(Math.abs(zero - yOf(value)), 0.8));
      return {
        x: round(xOf(day) - width / 2),
        y: value >= 0 ? round(zero - height) : zero,
        width,
        height,
        tone: index === series.points.length - 1 ? "now" : outside.has(day) ? "outside" : "past",
      };
    });
    return { kind, line: null, peak: null, refY: zero, bars, events, now: null, ticks };
  }

  const line = series.points.map(([day, value]) => `${xOf(day)},${yOf(value)}`).join(" ");
  let peak: string | null = null;
  if (series.peak) {
    // 階段: 次の日付まで高さを保ち、日付の位置で上がる
    const corners: string[] = [];
    series.peak.forEach(([day, value], index) => {
      if (index > 0) corners.push(`${xOf(day)},${yOf(series.peak![index - 1][1])}`);
      corners.push(`${xOf(day)},${yOf(value)}`);
    });
    peak = corners.join(" ");
  }
  const [lastDay, lastValue] = series.points.at(-1)!;
  return {
    kind,
    line,
    peak,
    refY,
    bars: [],
    events,
    now: { leftPct: round((xOf(lastDay) / SPARK_WIDTH) * 100), top: yOf(lastValue) },
    ticks,
  };
}
