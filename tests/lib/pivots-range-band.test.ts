import { describe, expect, it } from "vitest";
import {
  RANGE_BAND_LAYOUT as L,
  buildRangeBand,
  legendItems,
  upDownRows,
  workedExample,
} from "@/lib/pivots/range-band";
import type { RangeBand } from "@/lib/pivots/types";

type Band = NonNullable<RangeBand[keyof RangeBand]>;

const band: Band = {
  as_of: "2026-11-13",
  close: 68314.01,
  realized_vol_30d: 0.3845,
  items: [
    { id: "either7", side: "both", horizon_days: 7, k: 1.25, threshold: 0.0666, lo: 63767, hi: 72861, usual_pct: 26.87 },
    { id: "either30", side: "both", horizon_days: 30, k: 1.5, threshold: 0.1653, lo: 57019, hi: 79609, usual_pct: 27.0 },
    { id: "up7", side: "up", horizon_days: 7, k: 1, threshold: 0.0533, hi: 71955, usual_pct: 14.2 },
    { id: "down7", side: "down", horizon_days: 7, k: 1, threshold: 0.0533, lo: 64673, usual_pct: 17.8 },
    { id: "up30", side: "up", horizon_days: 30, k: 1, threshold: 0.11, hi: 75830, usual_pct: 18.0 },
    { id: "down30", side: "down", horizon_days: 30, k: 1, threshold: 0.11, lo: 60800, usual_pct: 22.0 },
  ],
  threshold_7d_365: { min: 0.046, max: 0.09, position: "mid" },
  source: { question_set: "q-2026-11", version: "v", usual_period: "2021-12-28.." },
};

const dateAt = (back: number) => new Date(Date.UTC(2026, 10, 13) - back * 86400000).toISOString().slice(0, 10);
const history = Array.from({ length: 70 }, (_, i) => ({
  date: dateAt(69 - i), // 最後が基準日 (2026-11-13)
  close: 80000 - i * 150 + (i % 5) * 400,
}));

describe("buildRangeBand", () => {
  const m = buildRangeBand(history, band);

  it("layout is the prototype's 340x222", () => {
    expect(L.width).toBe(340);
    expect(L.height).toBe(222);
  });

  it("uses one scale: label values match band edges and today price", () => {
    const by = (id: string) => m.labels.find((x) => x.id === id)!;
    expect(by("hi30").value).toBe(79609);
    expect(by("hi7").value).toBe(72861);
    expect(by("now").value).toBe(68314.01);
    expect(by("lo7").value).toBe(63767);
    expect(by("lo30").value).toBe(57019);
    // 高い値段ほど上 (y が小さい)
    expect(by("hi30").y).toBeLessThan(by("hi7").y);
    expect(by("hi7").y).toBeLessThan(by("now").y);
    expect(by("now").y).toBeLessThan(by("lo7").y);
    expect(by("lo7").y).toBeLessThan(by("lo30").y);
    // 箱の縁と同じ scale
    const b7 = m.bands.find((x) => x.id === "b7")!;
    const b30 = m.bands.find((x) => x.id === "b30")!;
    expect(b7.y).toBeCloseTo(m.scaleY(72861), 6);
    expect(b7.y + b7.height).toBeCloseTo(m.scaleY(63767), 6);
    expect(b30.y).toBeCloseTo(m.scaleY(79609), 6);
    expect(b30.y + b30.height).toBeCloseTo(m.scaleY(57019), 6);
    expect(m.todayDot.y).toBeCloseTo(m.scaleY(68314.01), 6);
  });

  it("all drawn y stay inside the plot", () => {
    for (const p of m.lines.price) {
      expect(p.y).toBeGreaterThanOrEqual(L.plotTop);
      expect(p.y).toBeLessThanOrEqual(L.plotBottom);
    }
    for (const b of m.bands) {
      expect(b.y).toBeGreaterThanOrEqual(L.plotTop);
      expect(b.y + b.height).toBeLessThanOrEqual(L.plotBottom);
    }
  });

  it("bands only to the right of today, 7d width = 7 slots, 30d = 30 slots", () => {
    const b7 = m.bands.find((x) => x.id === "b7")!;
    const b30 = m.bands.find((x) => x.id === "b30")!;
    expect(b7.x).toBe(L.todayX);
    expect(b30.x).toBe(L.todayX);
    expect(b7.width).toBeCloseTo(7 * L.step, 6);
    expect(b30.width).toBeCloseTo(30 * L.step, 6);
    expect(b30.x + b30.width).toBeCloseTo(L.futureRight, 6);
    for (const p of m.lines.price) expect(p.x).toBeLessThanOrEqual(L.todayX + 1e-9);
  });

  it("price line: last 61 closes ending at today's slot", () => {
    expect(m.lines.price).toHaveLength(61);
    expect(m.lines.price[0].x).toBeCloseTo(L.left, 6);
    expect(m.lines.price[60].x).toBeCloseTo(L.todayX, 6);
  });

  it("dotted line from today's dot to today's price; 7d edges to their prices", () => {
    const today = m.lines.leads.find((x) => x.id === "now")!;
    expect(today.x1).toBe(L.todayX);
    expect(today.x2).toBe(L.labelX - 3);
    expect(today.y).toBeCloseTo(m.todayDot.y, 6);
    const b7 = m.bands.find((x) => x.id === "b7")!;
    const hi7 = m.lines.leads.find((x) => x.id === "hi7")!;
    const lo7 = m.lines.leads.find((x) => x.id === "lo7")!;
    expect(hi7.x1).toBeCloseTo(b7.x + b7.width, 6);
    expect(hi7.y).toBeCloseTo(b7.y, 6);
    expect(lo7.y).toBeCloseTo(b7.y + b7.height, 6);
  });

  it("axis ticks", () => {
    expect(m.axis.y).toBe(L.plotBottom);
    expect(m.axis.ticks.map((t) => t.kind)).toEqual(["start", "mid", "today", "end"]);
    expect(m.axis.ticks[2].x).toBe(L.todayX);
    expect(m.axis.ticks[3].x).toBeCloseTo(L.futureRight, 6);
  });

  it("a history that stops before as_of gets a final (as_of, close) point", () => {
    const stale = history.slice(0, 69); // 最後の日 (基準日) を欠く
    const s = buildRangeBand(stale, band);
    const n = s.lines.price.length;
    expect(n).toBe(61);
    expect(s.lines.price[n - 1].x).toBeCloseTo(L.todayX, 6);
    expect(s.lines.price[n - 1].y).toBeCloseTo(s.todayDot.y, 6);
  });

  it("short history still ends at today", () => {
    const s = buildRangeBand(history.slice(-10), band);
    expect(s.lines.price).toHaveLength(10);
    expect(s.lines.price[9].x).toBeCloseTo(L.todayX, 6);
  });
});

describe("legendItems", () => {
  it("7d and 30d with +-pct from threshold (1 decimal) and ten-scale", () => {
    expect(legendItems(band)).toEqual([
      { id: "b7", days: 7, lo: "63,767", hi: "72,861", widthPct: "6.7", usualPct: 27, tenN: 3 },
      { id: "b30", days: 30, lo: "57,019", hi: "79,609", widthPct: "16.5", usualPct: 27, tenN: 3 },
    ]);
  });
});

describe("upDownRows", () => {
  it("four questions, up/down lines", () => {
    const rows = upDownRows(band);
    expect(rows.map((r) => r.id)).toEqual(["up7", "down7", "up30", "down30"]);
    expect(rows[0]).toMatchObject({ side: "up", horizonDays: 7, widthPct: "5.3", price: "71,955", usualPct: 14, tenN: 1 });
    expect(rows[1]).toMatchObject({ side: "down", price: "64,673", usualPct: 18, tenN: 2 });
  });
  it("missing items are skipped", () => {
    const b = { ...band, items: band.items.slice(0, 2) };
    expect(upDownRows(b)).toEqual([]);
  });
});

describe("workedExample", () => {
  it("numbers match the band (spec 4.5)", () => {
    const w = workedExample(band, "BTC", "2026-11-13");
    expect(w).toMatchObject({
      asset: "BTC",
      closeDate: "2026-11-13",
      closeMonth: 11,
      closeDay: 13,
      close: "68,314",
      dailyPct: "2.0",
      annualPct: 38,
      sqrtN: "2.6",
      k: 1.25,
      widthPct: "6.7",
      lo: "63,767",
      hi: "72,861",
      usualPct: 27,
      tenN: 3,
      restN: 7,
      minPct: "4.6",
      maxPct: "9.0",
      position: "mid",
    });
  });
  it("width steps are consistent: daily x sqrtN x k ~ width", () => {
    const w = workedExample(band, "BTC", "2026-11-13");
    expect(Math.abs(Number(w.dailyPct) * Number(w.sqrtN) * w.k - Number(w.widthPct))).toBeLessThan(0.3);
  });
  it("falls back to close*(1-+threshold) when lo/hi absent", () => {
    const b = { ...band, items: band.items.map((i) => ({ ...i, lo: undefined, hi: undefined })) };
    const w = workedExample(b, "BTC", "2026-11-13");
    expect(w.lo).toBe("63,764");
    expect(w.hi).toBe("72,864");
  });
  it("numbers in prose are pre-formatted strings (2.0 / 9.0 / 7.0 / 11.0 keep the .0, floats are rounded with commas)", () => {
    const b = {
      ...band,
      realized_vol_30d: 0.3820,
      items: band.items.map((i) =>
        i.id === "either7" ? { ...i, threshold: 0.07, lo: 63767.4321, hi: 72861.5 } : i.id === "up30" ? { ...i, threshold: 0.11 } : i,
      ),
      threshold_7d_365: { min: 0.046, max: 0.09, position: "high" as const },
    };
    const w = workedExample(b, "BTC", "2026-11-13");
    expect(w).toMatchObject({ widthPct: "7.0", maxPct: "9.0", lo: "63,767", hi: "72,862", close: "68,314" });
    expect(legendItems(b)[0]).toMatchObject({ widthPct: "7.0", lo: "63,767" });
    expect(upDownRows(b).find((r) => r.id === "up30")!.widthPct).toBe("11.0");
    expect(workedExample(b, "BTC", "2026-11-13").dailyPct).toBe("2.0");
  });
});
