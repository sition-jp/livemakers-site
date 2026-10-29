import { describe, expect, it } from "vitest";
import {
  PROBABILITY_LAYOUT as L,
  buildProbabilityTimeline,
} from "@/lib/pivots/probability-timeline";
import type { ForecastHistoryEntry, TurnEntry } from "@/lib/pivots/types";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** n days ending at `end` (inclusive). */
function mkHistory(n: number, end = "2026-10-26"): ForecastHistoryEntry[] {
  const out: ForecastHistoryEntry[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(end, -(n - 1 - i));
    out.push({
      date,
      close: 100 + i,
      forecast: { turn: { "30D": 10 + (i % 50) }, move: { "30D": 20 } },
      outcome: { turn: { "30D": i % 2 ? "hit" : "miss" }, move: { "30D": "pending" } },
      backfilled: false,
    });
  }
  return out;
}

const base = { turns: [] as TurnEntry[], event: "turn" as const, horizon: "30D" as const, todayPct: 12, usualPct: 8 };

describe("buildProbabilityTimeline", () => {
  it("layout constants match the mockup", () => {
    expect(L.width).toBe(760);
    expect(L.height).toBe(350);
    expect(L.left).toBe(40);
    expect(L.right).toBe(720);
    expect(L.priceTop).toBe(30);
    expect(L.priceBottom).toBe(110);
    expect(L.barTop).toBe(120);
    expect(L.barBottom).toBe(290);
    expect(L.tickY).toBe(322);
  });

  it("spans 120 past + 30 future days across left..right", () => {
    const m = buildProbabilityTimeline({ ...base, history: mkHistory(120) });
    const slot = (L.right - L.left) / 150;
    expect(m.bars).toHaveLength(120);
    expect(m.bars[0].x).toBeGreaterThanOrEqual(L.left);
    expect(m.bars[0].x).toBeLessThan(L.left + slot);
    expect(m.todayX).toBeCloseTo(L.left + 119.5 * slot, 6);
    expect(m.future.x0).toBeCloseTo(L.left + 120 * slot, 6);
    expect(m.future.x1).toBe(L.right);
    expect(m.future.endDate).toBe("2026-11-25");
    expect(m.bars[1].x - m.bars[0].x).toBeCloseTo(slot, 6);
    expect(m.bars[0].width).toBeGreaterThan(0);
    expect(m.bars[0].width).toBeLessThan(slot);
  });

  it("bar status: today / outcome / pending, backfilled passes through", () => {
    const h = mkHistory(5);
    h[1] = { ...h[1], backfilled: true };
    h[2] = { ...h[2], outcome: undefined };
    const m = buildProbabilityTimeline({ ...base, history: h });
    const by = Object.fromEntries(m.bars.map((b) => [b.date, b]));
    expect(by[h[4].date].status).toBe("today");
    expect(by[h[0].date].status).toBe("miss");
    expect(by[h[3].date].status).toBe("hit");
    expect(by[h[2].date].status).toBe("pending");
    expect(by[h[1].date].backfilled).toBe(true);
    expect(by[h[0].date].backfilled).toBe(false);
  });

  it("bar height is pct of the bar band, bottom-anchored", () => {
    const h = mkHistory(3);
    h[0].forecast = { turn: { "30D": 50 } };
    h[1].forecast = { turn: { "30D": 100 } };
    h[2].forecast = { turn: { "30D": 0 } };
    const m = buildProbabilityTimeline({ ...base, history: h });
    const band = L.barBottom - L.barTop;
    expect(m.bars[0].height).toBeCloseTo(band / 2, 6);
    expect(m.bars[0].y).toBeCloseTo(L.barBottom - band / 2, 6);
    expect(m.bars[1].height).toBeCloseTo(band, 6);
    expect(m.bars[2].height).toBe(0);
    expect(m.bars[0].pct).toBe(50);
  });

  it("days without forecast become gaps, no bar", () => {
    const h = mkHistory(4);
    h[1] = { date: h[1].date, close: 101, backfilled: false };
    const m = buildProbabilityTimeline({ ...base, history: h });
    expect(m.bars).toHaveLength(3);
    expect(m.gaps).toHaveLength(1);
    expect(m.gaps[0].date).toBe(h[1].date);
    expect(m.bars.find((b) => b.date === h[1].date)).toBeUndefined();
  });

  it("event=move reads the move forecast with the same shape", () => {
    const m = buildProbabilityTimeline({ ...base, event: "move", history: mkHistory(5) });
    expect(m.bars).toHaveLength(5);
    expect(m.bars[0].pct).toBe(20);
    expect(m.bars[0].status).toBe("pending");
    expect(m.bars[4].status).toBe("today");
  });

  it("price line: top = max, 1 day -> null, flat -> mid-band", () => {
    const m = buildProbabilityTimeline({ ...base, history: mkHistory(5) });
    expect(m.price!.points).toHaveLength(5);
    expect(m.price!.points[4][1]).toBe(L.priceTop);
    expect(m.price!.points[0][1]).toBe(L.priceBottom);
    const one = mkHistory(3).map((e, i) => (i === 0 ? e : { ...e, close: undefined }));
    expect(buildProbabilityTimeline({ ...base, history: one }).price).toBeNull();
    const flat = mkHistory(3).map((e) => ({ ...e, close: 50 }));
    const fp = buildProbabilityTimeline({ ...base, history: flat }).price!;
    expect(fp.points[0][1]).toBe((L.priceTop + L.priceBottom) / 2);
  });

  it("markers: drop out-of-range, size by strength, tops above / bottoms below", () => {
    const h = mkHistory(10);
    const turns: TurnEntry[] = [
      { date: h[2].date, kind: "top", close: 102, strength: "small" },
      { date: h[4].date, kind: "bottom", close: 104, strength: "medium" },
      { date: h[6].date, kind: "top", close: 106, strength: "large" },
      { date: h[8].date, kind: "bottom", close: 108, strength: "cycle" },
      { date: "2020-01-01", kind: "top", close: 1, strength: "cycle" },
      { date: addDays(h[9].date, 3), kind: "top", close: 1, strength: "cycle" },
    ];
    const m = buildProbabilityTimeline({ ...base, history: h, turns });
    expect(m.markers.map((k) => k.size)).toEqual([8, 11, 14, 18]);
    expect(m.markers).toHaveLength(4);
    const pt = (d: string) => m.price!.points[h.findIndex((e) => e.date === d)];
    expect(m.markers[0].y).toBeLessThan(pt(h[2].date)[1]);
    expect(m.markers[1].y).toBeGreaterThan(pt(h[4].date)[1]);
    expect(m.markers[0].x).toBe(pt(h[2].date)[0]);
  });

  it("markers on a date without close are skipped", () => {
    const h = mkHistory(5);
    h[2] = { ...h[2], close: undefined };
    const turns: TurnEntry[] = [{ date: h[2].date, kind: "top", close: 1, strength: "small" }];
    expect(buildProbabilityTimeline({ ...base, history: h, turns }).markers).toHaveLength(0);
  });

  it("ticks every Monday incl. future, M/D no padding", () => {
    // 2026-10-26 is a Monday
    const m = buildProbabilityTimeline({ ...base, history: mkHistory(8, "2026-10-26"), futureDays: 14 });
    expect(m.ticks.map((t) => t.date)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(m.ticks.map((t) => t.label)).toEqual(["10/19", "10/26", "11/2", "11/9"]);
    const slot = (L.right - L.left) / 22;
    expect(m.ticks[1].x).toBeCloseTo(L.left + 7 * slot, 6);
  });

  it("null todayPct / usualPct do not break", () => {
    const m = buildProbabilityTimeline({ ...base, todayPct: null, usualPct: null, history: mkHistory(5) });
    expect(m.usualY).toBeNull();
    expect(m.future.todayPct).toBeNull();
    expect(m.future.usualPct).toBeNull();
    const m2 = buildProbabilityTimeline({ ...base, usualPct: 50, history: mkHistory(5) });
    expect(m2.usualY).toBeCloseTo((L.barTop + L.barBottom) / 2, 6);
  });

  it("pastDays: 60 uses only the latest 60 days; futureDays default by horizon", () => {
    const m = buildProbabilityTimeline({ ...base, history: mkHistory(120), pastDays: 60 });
    expect(m.bars).toHaveLength(60);
    expect(m.bars[0].date).toBe(addDays("2026-10-26", -59));
    expect(m.future.endDate).toBe("2026-11-25");
    const m7 = buildProbabilityTimeline({ ...base, horizon: "7D", history: mkHistory(5) });
    expect(m7.future.endDate).toBe("2026-11-02");
    const m90 = buildProbabilityTimeline({ ...base, horizon: "90D", history: mkHistory(5) });
    expect(m90.future.endDate).toBe(addDays("2026-10-26", 90));
  });

  it("empty history does not throw", () => {
    const m = buildProbabilityTimeline({ ...base, history: [] });
    expect(m.bars).toEqual([]);
    expect(m.price).toBeNull();
  });
});
