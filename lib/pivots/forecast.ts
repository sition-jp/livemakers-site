// 予報・強さのはしご・トレンドの純関数 (it-2026-10 段 3)。
// 文字列の文は作らない: キーと値を返し、部品が useTranslations で文にする (describe.ts と同じ分け方)。
import type { ForecastItem, LadderRow, TurnEntry } from "./types";

type Horizon = ForecastItem["horizon"];
type Event = ForecastItem["event"];
type Strength = LadderRow["strength"];
type Kind = TurnEntry["kind"];

/** Task 0 の事前登録の「兆し」と同じ (ポイント差)。 */
export const SIGNAL_GAP_PTS = 10;

export type Level = "above" | "usual" | "below";

export function forecastLevel(todayPct: number, usualPct: number): Level {
  const gap = todayPct - usualPct;
  if (gap >= SIGNAL_GAP_PTS) return "above";
  if (gap <= -SIGNAL_GAP_PTS) return "below";
  return "usual";
}

export type QuestionId = "turn30" | "turn90" | "turn7" | "move30";

export const QUESTIONS: readonly {
  id: QuestionId;
  event: Event;
  horizon: Horizon;
  role: "main" | "normal" | "reference";
}[] = [
  { id: "turn30", event: "turn", horizon: "30D", role: "main" },
  { id: "turn90", event: "turn", horizon: "90D", role: "normal" },
  { id: "turn7", event: "turn", horizon: "7D", role: "reference" },
  { id: "move30", event: "move", horizon: "30D", role: "normal" },
];

export function pickForecast(
  items: ForecastItem[] | undefined,
  event: Event,
  horizon: Horizon,
): ForecastItem | null {
  return items?.find((i) => i.event === event && i.horizon === horizon) ?? null;
}

export type SentenceLine = {
  key: "today" | "d7" | "d30" | "d90";
  values: Record<string, string | number>;
};

function levelOf(i: ForecastItem | null): Level | "none" {
  return i ? forecastLevel(i.today_pct, i.usual_pct) : "none";
}

/** 予報の 4 行。値が無い問いの行は省く。「今日の状態」は turn 30D か move 30D のどちらかがあれば出す。 */
export function forecastLines(items: ForecastItem[]): SentenceLine[] {
  const t30 = pickForecast(items, "turn", "30D");
  const m30 = pickForecast(items, "move", "30D");
  const t7 = pickForecast(items, "turn", "7D");
  const t90 = pickForecast(items, "turn", "90D");
  const lines: SentenceLine[] = [];
  if (t30 || m30) {
    lines.push({ key: "today", values: { turnLevel: levelOf(t30), moveLevel: levelOf(m30) } });
  }
  if (t7) {
    lines.push({
      key: "d7",
      values: { level: levelOf(t7), today: t7.today_pct, usual: t7.usual_pct },
    });
  }
  if (t30) {
    const values: Record<string, string | number> = {
      level: levelOf(t30),
      today: t30.today_pct,
      usual: t30.usual_pct,
    };
    if (m30) {
      values.moveLevel = levelOf(m30);
      values.moveToday = m30.today_pct;
      values.moveUsual = m30.usual_pct;
    }
    lines.push({ key: "d30", values });
  }
  if (t90) {
    lines.push({
      key: "d90",
      values: { level: levelOf(t90), today: t90.today_pct, usual: t90.usual_pct },
    });
  }
  return lines;
}

// --- 数値・日付の表記 ---

export function pctChange(from: number, to: number): number {
  return Math.round(((to - from) / from) * 1000) / 10;
}

const PRICE_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const SMALL_PRICE_FMT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1,000 以上は整数・3 桁区切り、未満は小数 2 桁 (どちらの言語も en-US)。 */
export function formatPrice(n: number): string {
  return Math.abs(n) >= 1000 ? PRICE_FMT.format(n) : SMALL_PRICE_FMT.format(n);
}

/** 符号付き・小数 1 桁 (% 記号は付けない)。マイナスは U+2212。 */
export function formatSignedPct(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "±0.0";
  return r > 0 ? `+${r.toFixed(1)}` : `−${Math.abs(r).toFixed(1)}`;
}

/** 日足 (UTC) の日付をそのまま出す。ja = 2026/6/30・en = 2026-06-30。 */
export function formatDay(iso: string, locale: "ja" | "en"): string {
  if (locale === "en") return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

// --- トレンド ---

export type TrendLine = {
  key: "up" | "down" | "flat";
  values: { r30?: string; r90?: string };
};

/** 90 日優先 (±10)。90 日が無ければ 30 日で同じ判定。両方無ければ null。
 *  values は formatSignedPct 済み (% は文言側)。片方しか無いときはそのキーだけ入る。 */
export function trendLine(
  trend: { ret_30d_pct?: number; ret_90d_pct?: number } | undefined,
): TrendLine | null {
  const r30 = trend?.ret_30d_pct;
  const r90 = trend?.ret_90d_pct;
  const basis = r90 ?? r30;
  if (basis === undefined) return null;
  const key = basis >= 10 ? "up" : basis <= -10 ? "down" : "flat";
  const values: TrendLine["values"] = {};
  if (r30 !== undefined) values.r30 = formatSignedPct(r30);
  if (r90 !== undefined) values.r90 = formatSignedPct(r90);
  return { key, values };
}

// --- 強さのはしご ---

export type LadderView = {
  strength: Strength;
  /** 文言キー (ladder.threshold.<strength>) で「5% / 15% / 3 割 / 5 割」に直す。 */
  threshold: Strength;
  lastConfirmed: { date: string; kind: Kind; close: number; pctFromNow: number | null } | null;
  candidate: { date: string; kind: Kind; close: number } | null;
  condition: { kind: Kind; price: number; pctFromNow: number | null } | null;
  note: { date: string; close: number } | null;
};

const LADDER_ORDER: readonly Strength[] = ["cycle", "large", "medium", "small"];

/** Review Focus 5: その行の last_confirmed (底/天井) より後の日付で、ほかの行の
 *  last_confirmed / candidate にある同じ種類のもっと極端な点 (底ならより安い・天井ならより高い) のうち一番極端なもの。 */
function laterExtreme(row: LadderRow, all: LadderRow[]): { date: string; close: number } | null {
  const lc = row.last_confirmed;
  if (!lc) return null;
  let best: { date: string; close: number } | null = null;
  for (const other of all) {
    if (other === row) continue;
    for (const p of [other.last_confirmed, other.candidate]) {
      if (!p || p.kind !== lc.kind || p.date <= lc.date) continue;
      const more = lc.kind === "bottom" ? p.close < lc.close : p.close > lc.close;
      if (!more) continue;
      const beats =
        best === null || (lc.kind === "bottom" ? p.close < best.close : p.close > best.close);
      if (beats) best = { date: p.date, close: p.close };
    }
  }
  return best;
}

/** 4 行を サイクル級 → 大 → 中 → 小 の順に並べ直す (入力に無い強さの行は作らない)。
 *  pctFromNow の向き: lastConfirmed = 確定した価格から今まで (pctChange(close, nowClose))・
 *  condition = 今からその価格まで (pctChange(nowClose, price))。nowClose が null なら null。 */
export function ladderRows(rows: LadderRow[] | undefined, nowClose: number | null): LadderView[] {
  if (!rows) return [];
  const out: LadderView[] = [];
  for (const strength of LADDER_ORDER) {
    const row = rows.find((r) => r.strength === strength);
    if (!row) continue;
    const lc = row.last_confirmed;
    const cand = row.decided ? row.candidate : null;
    out.push({
      strength,
      threshold: strength,
      lastConfirmed: lc
        ? {
            date: lc.date,
            kind: lc.kind,
            close: lc.close,
            pctFromNow: nowClose === null ? null : pctChange(lc.close, nowClose),
          }
        : null,
      candidate: cand ? { date: cand.date, kind: cand.kind, close: cand.close } : null,
      condition:
        cand && row.confirm_at !== null
          ? {
              kind: cand.kind,
              price: row.confirm_at,
              pctFromNow: nowClose === null ? null : pctChange(nowClose, row.confirm_at),
            }
          : null,
      note: laterExtreme(row, rows),
    });
  }
  return out;
}
