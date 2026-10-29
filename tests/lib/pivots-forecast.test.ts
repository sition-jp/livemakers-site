import { describe, it, expect } from "vitest";
import {
  SIGNAL_GAP_PTS,
  QUESTIONS,
  forecastLevel,
  pickForecast,
  forecastLines,
  trendLine,
  TREND_GAP_PCT,
  ladderRows,
  pctChange,
  formatPrice,
  formatSignedPct,
  formatPct1,
  formatDay,
} from "@/lib/pivots/forecast";
import type { ForecastItem, LadderRow } from "@/lib/pivots/types";
import ja from "@/messages/ja.json";
import en from "@/messages/en.json";

const item = (event: "turn" | "move", horizon: "7D" | "30D" | "90D", t: number, u: number): ForecastItem => ({
  event,
  horizon,
  today_pct: t,
  usual_pct: u,
});

describe("forecastLevel", () => {
  it("uses ±10 pts as the boundary", () => {
    expect(SIGNAL_GAP_PTS).toBe(10);
    expect(forecastLevel(60, 50)).toBe("above");
    expect(forecastLevel(59.9, 50)).toBe("usual");
    expect(forecastLevel(40, 50)).toBe("below");
    expect(forecastLevel(40.1, 50)).toBe("usual");
  });
  it("is not broken by floating-point error on one-decimal inputs", () => {
    expect(forecastLevel(20.4, 10.4)).toBe("above");
    expect(forecastLevel(10.4, 20.4)).toBe("below");
  });
});

describe("QUESTIONS / pickForecast", () => {
  it("is ordered turn30 (main), turn90, turn7 (reference), move30", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(["turn30", "turn90", "turn7", "move30"]);
    expect(QUESTIONS.map((q) => q.role)).toEqual(["main", "normal", "reference", "normal"]);
  });
  it("picks by event and horizon, or null", () => {
    const items = [item("turn", "30D", 50, 48)];
    expect(pickForecast(items, "turn", "30D")?.today_pct).toBe(50);
    expect(pickForecast(items, "move", "30D")).toBeNull();
    expect(pickForecast(undefined, "turn", "30D")).toBeNull();
  });
});

describe("forecastLines", () => {
  const all = [
    item("turn", "7D", 44.6, 47.3),
    item("turn", "30D", 62, 48.3),
    item("turn", "90D", 19.3, 15),
    item("move", "30D", 60, 70.8),
  ];
  it("emits four lines when everything exists", () => {
    const l = forecastLines(all);
    expect(l.map((x) => x.key)).toEqual(["today", "d7", "d30", "d90"]);
    expect(l[0].values).toEqual({ turnLevel: "above", moveLevel: "below" });
    expect(l[1].values).toEqual({ level: "usual", today: 44.6, usual: 47.3 });
    expect(l[2].values).toEqual({
      level: "above", today: 62, usual: 48.3, moveLevel: "below", moveToday: 60, moveUsual: 70.8,
    });
  });
  it("omits the move part of d30 when move 30D is missing", () => {
    const l = forecastLines(all.filter((i) => i.event !== "move"));
    expect(l[0].values).toEqual({ turnLevel: "above", moveLevel: "none" });
    expect(l.find((x) => x.key === "d30")!.values).not.toHaveProperty("moveLevel");
  });
  it("keeps today and nothing else when only move 30D exists", () => {
    const l = forecastLines([item("move", "30D", 60, 60)]);
    expect(l.map((x) => x.key)).toEqual(["today"]);
    expect(l[0].values).toEqual({ turnLevel: "none", moveLevel: "usual" });
  });
  it("returns [] for empty input", () => {
    expect(forecastLines([])).toEqual([]);
  });
});

describe("trendLine", () => {
  it("prefers 90d and returns the full message key", () => {
    expect(trendLine({ ret_30d_pct: -2.8, ret_90d_pct: 25.3 })).toEqual({
      key: "up",
      values: { r30: "\u22122.8", r90: "+25.3" },
    });
    expect(trendLine({ ret_30d_pct: 20, ret_90d_pct: -10 })?.key).toBe("down");
    expect(trendLine({ ret_30d_pct: 20, ret_90d_pct: 9.9 })?.key).toBe("flat");
  });
  it("is up at exactly +10 and down at exactly -10 (90d)", () => {
    expect(trendLine({ ret_30d_pct: 0, ret_90d_pct: 10 })?.key).toBe("up");
    expect(trendLine({ ret_30d_pct: 0, ret_90d_pct: -10 })?.key).toBe("down");
    expect(TREND_GAP_PCT).toBe(10);
  });
  it("30-only variants", () => {
    expect(trendLine({ ret_30d_pct: 10 })).toEqual({ key: "up_30only", values: { r30: "+10.0" } });
    expect(trendLine({ ret_30d_pct: -10 })?.key).toBe("down_30only");
    expect(trendLine({ ret_30d_pct: -3 })?.key).toBe("flat_30only");
  });
  it("90-only variants", () => {
    expect(trendLine({ ret_90d_pct: 12 })).toEqual({ key: "up_90only", values: { r90: "+12.0" } });
    expect(trendLine({ ret_90d_pct: -12 })?.key).toBe("down_90only");
    expect(trendLine({ ret_90d_pct: 1 })?.key).toBe("flat_90only");
  });
  it("is null with neither", () => {
    expect(trendLine({})).toBeNull();
    expect(trendLine(undefined)).toBeNull();
  });
  it("every returned key exists in ja and en messages", () => {
    const keys = ["up","up_30only","up_90only","down","down_30only","down_90only","flat","flat_30only","flat_90only"];
    for (const m of [ja, en] as unknown as { turningPoints: { forecast: { trend: Record<string, string> } } }[])
      for (const k of keys) expect(m.turningPoints.forecast.trend[k]).toBeTruthy();
  });
});

describe("formatters", () => {
  it("pctChange rounds to 1 decimal", () => {
    expect(pctChange(124658.54, 81537)).toBe(-34.6);
    expect(pctChange(81537, 87937.065)).toBe(7.8);
  });
  it("formatPrice", () => {
    expect(formatPrice(87937.065)).toBe("87,937");
    expect(formatPrice(60633.99999999999)).toBe("60,634");
    expect(formatPrice(999.5)).toBe("999.50");
    expect(formatPrice(0.5)).toBe("0.50");
  });
  it("formatPct1 is one decimal without a sign or % mark", () => {
    expect(formatPct1(48)).toBe("48.0");
    expect(formatPct1(50.94)).toBe("50.9");
    expect(formatPct1(0)).toBe("0.0");
  });
  it("formatSignedPct uses U+2212", () => {
    expect(formatSignedPct(2)).toBe("+2.0");
    expect(formatSignedPct(-1.5)).toBe("−1.5");
    expect(formatSignedPct(0)).toBe("±0.0");
  });
  it("formatDay", () => {
    expect(formatDay("2026-06-30", "ja")).toBe("2026/6/30");
    expect(formatDay("2026-06-30", "en")).toBe("2026-06-30");
  });
});

// 2026-10-17 の BTC (終値 81,537)・設計書 §5.5 の表
const P = (date: string, kind: "top" | "bottom", close: number) => ({ date, kind, close });
const BTC_1017: LadderRow[] = [
  { strength: "small", decided: true, last_confirmed: P("2026-09-21", "top", 86620), candidate: P("2026-10-17", "bottom", 81537), confirm_at: 85613.85 },
  { strength: "medium", decided: true, last_confirmed: P("2026-06-30", "bottom", 58624.71), candidate: P("2026-09-21", "top", 86620), confirm_at: 73627 },
  { strength: "large", decided: true, last_confirmed: P("2026-02-05", "bottom", 62909.86), candidate: P("2026-09-21", "top", 86620), confirm_at: 60633.99999999999 },
  { strength: "cycle", decided: true, last_confirmed: P("2025-10-06", "top", 124658.54), candidate: P("2026-06-30", "bottom", 58624.71), confirm_at: 87937.065 },
];

describe("ladderRows", () => {
  const rows = ladderRows(BTC_1017, 81537);
  it("orders cycle → large → medium → small regardless of input order", () => {
    expect(rows.map((r) => r.strength)).toEqual(["cycle", "large", "medium", "small"]);
    expect(rows.map((r) => r.threshold)).toEqual(["cycle", "large", "medium", "small"]);
  });
  it("cycle row matches the §5.5 table", () => {
    const c = rows[0];
    expect(c.lastConfirmed).toEqual({ date: "2025-10-06", kind: "top", close: 124658.54, pctFromNow: -34.6 });
    expect(c.candidate).toEqual({ date: "2026-06-30", kind: "bottom", close: 58624.71 });
    expect(c.condition).toEqual({ kind: "bottom", price: 87937.065, pctFromNow: 7.8 });
    expect(formatPrice(c.candidate!.close)).toBe("58,625");
    expect(formatPrice(c.condition!.price)).toBe("87,937");
    expect(c.note).toBeNull();
  });
  it("large row gets the Review Focus 5 note (6/30 low of 58,625)", () => {
    expect(rows[1].note).toEqual({ date: "2026-06-30", close: 58624.71 });
    expect(rows[1].condition).toEqual({ kind: "top", price: 60633.99999999999, pctFromNow: -25.6 });
  });
  it("medium and small rows have no note", () => {
    expect(rows[2].note).toBeNull();
    expect(rows[3].note).toBeNull();
    expect(rows[3].condition?.kind).toBe("bottom");
  });
  it("does not use points on or before the confirmed date", () => {
    const r: LadderRow[] = [
      { strength: "large", decided: true, last_confirmed: P("2026-02-05", "bottom", 62909.86), candidate: P("2026-09-21", "top", 86620), confirm_at: 60634 },
      { strength: "medium", decided: true, last_confirmed: P("2025-12-01", "bottom", 50000), candidate: P("2026-02-05", "bottom", 40000), confirm_at: 46000 },
    ];
    expect(ladderRows(r, 80000).find((x) => x.strength === "large")!.note).toBeNull();
  });
  it("picks the most extreme point and handles tops", () => {
    const r: LadderRow[] = [
      { strength: "large", decided: true, last_confirmed: P("2026-01-01", "top", 100), candidate: P("2026-05-01", "bottom", 70), confirm_at: 91 },
      { strength: "medium", decided: true, last_confirmed: P("2026-02-01", "top", 110), candidate: P("2026-04-01", "top", 130), confirm_at: 110.5 },
      { strength: "small", decided: true, last_confirmed: P("2026-03-01", "top", 120), candidate: P("2026-04-10", "bottom", 90), confirm_at: 94 },
    ];
    expect(ladderRows(r, null).find((x) => x.strength === "large")!.note).toEqual({ date: "2026-04-01", close: 130 });
  });
  it("decided=false row: no candidate, no condition; null last_confirmed", () => {
    const r: LadderRow[] = [
      { strength: "cycle", decided: false, last_confirmed: null, candidate: null, confirm_at: null },
    ];
    expect(ladderRows(r, 81537)).toEqual([
      { strength: "cycle", threshold: "cycle", lastConfirmed: null, candidate: null, condition: null, note: null },
    ]);
  });
  it("pctFromNow is null without a now price", () => {
    const v = ladderRows(BTC_1017, null);
    expect(v[0].lastConfirmed!.pctFromNow).toBeNull();
    expect(v[0].condition!.pctFromNow).toBeNull();
  });
  it("omits absent strengths; undefined and empty give []", () => {
    expect(ladderRows(BTC_1017.slice(0, 1), 1).map((r) => r.strength)).toEqual(["small"]);
    expect(ladderRows(undefined, 1)).toEqual([]);
    expect(ladderRows([], 1)).toEqual([]);
  });
});

describe("forecast / ladder copy never asserts a prediction or direction", () => {
  const BANNED = [/予測/, /上がる/, /下がる/, /反転幅/, /predict/i, /goes up/i, /goes down/i];
  function walk(node: unknown, path: string, out: { path: string; value: string }[]) {
    if (typeof node === "string") out.push({ path, value: node });
    else if (node && typeof node === "object")
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, `${path}.${k}`, out);
  }
  type Tp = { turningPoints: { forecast: unknown; ladder: unknown } };
  const keysOf = (n: unknown, p = ""): string[] =>
    typeof n === "string" ? [p] : Object.entries(n as object).flatMap(([k, v]) => keysOf(v, p ? `${p}.${k}` : k));
  it.each([
    ["ja", ja as unknown as Tp],
    ["en", en as unknown as Tp],
  ])("%s: no banned word", (locale, m) => {
    for (const ns of ["forecast", "ladder"] as const) {
      const out: { path: string; value: string }[] = [];
      walk(m.turningPoints[ns], `${locale}.${ns}`, out);
      expect(out.length).toBeGreaterThan(5);
      for (const { path, value } of out)
        for (const re of BANNED) expect(re.test(value), `${path} = "${value}" matched ${re}`).toBe(false);
    }
  });
  it("ja and en have the same keys", () => {
    for (const ns of ["forecast", "ladder"] as const) {
      expect(keysOf((en as unknown as Tp).turningPoints[ns]).sort()).toEqual(
        keysOf((ja as unknown as Tp).turningPoints[ns]).sort(),
      );
    }
  });
});
