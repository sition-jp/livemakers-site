import { describe, expect, it } from "vitest";
import {
  chipParts,
  headlineParts,
  overviewParts,
  shockParts,
  signedIntPct,
  sinceDay,
  tenScale,
} from "@/lib/pivots/regime";
import type { Regime } from "@/lib/pivots/types";

type One = NonNullable<Regime[keyof Regime]>;
type Long = NonNullable<One["long"]>;

const longOf = (state: Long["state"], over: Partial<Long> = {}): Long => ({
  state,
  since_week: "2026-02-01",
  last_week: "2026-11-08",
  ath: { date: "2025-10-06", close: 124659, pct_from_ath: -45.2 },
  w100: 88000,
  trough: { week: "2026-02-08", close: 60000 },
  peak: null,
  line_to_down: null,
  line_to_leave_down: null,
  ...over,
});

const nearOf = (state: "up" | "flat" | "down", pct: number): One["near"] => ({
  state,
  since: "2026-10-31",
  days: 14,
  ret_30d_pct: pct,
  close_30d_ago: 81682.01,
  close: 68314.01,
});

const make = (over: Partial<One>): One => ({
  as_of: "2026-11-13",
  long: longOf("down"),
  mid: { state: "range", since: "2026-11-08", days: 6 },
  near: nearOf("down", -16.4),
  ...over,
});

describe("tenScale / signedIntPct", () => {
  it("rounds to a 10-scale", () => {
    expect(tenScale(27)).toBe(3);
    expect(tenScale(18)).toBe(2);
    expect(tenScale(26.87)).toBe(3);
    expect(tenScale(4)).toBe(0);
  });
  it("signs with U+2212 and ±0", () => {
    expect(signedIntPct(-16.4)).toBe("−16");
    expect(signedIntPct(12.2)).toBe("+12");
    expect(signedIntPct(0)).toBe("±0");
    expect(signedIntPct(-0.4)).toBe("±0");
    expect(signedIntPct(0.4)).toBe("±0");
  });
});

describe("headlineParts long (report §5 seven combinations)", () => {
  const cases: [Long["state"], "up" | "flat" | "down", number, string][] = [
    ["down", "down", -16, "also_down"],
    ["down", "up", 12, "rebound"],
    ["down", "flat", 2, "flat"],
    ["up", "up", 12, "also_up"],
    ["up", "down", -9, "down"],
    ["up", "flat", 1, "flat"],
    ["recovering", "down", -20, "down"],
    ["recovering", "up", 8, "up"],
    ["recovering", "flat", 0, "flat"],
  ];
  it.each(cases)("%s x %s", (long, near, pct, thirty) => {
    const parts = headlineParts(make({ long: longOf(long), near: nearOf(near, pct) }), "long");
    expect(parts).toEqual([
      { key: `headline.flow.${long}`, values: {} },
      { key: `headline.thirty.${thirty}`, values: { pct: signedIntPct(pct) } },
    ]);
  });

  it("matching pct sign for up/down wording", () => {
    const up = headlineParts(make({ long: longOf("up"), near: nearOf("up", 12) }), "long");
    expect(up[1].values.pct).toBe("+12");
  });

  it("no long: near-only sentence", () => {
    const parts = headlineParts(make({ long: null, near: nearOf("down", -16.4) }), "long");
    expect(parts).toEqual([{ key: "headline.near_only.down", values: { pct: "−16" } }]);
    expect(headlineParts(make({ long: null, near: null }), "long")).toEqual([]);
  });
});

describe("headlineParts mid / near (§4.1.1)", () => {
  it("mid range with long", () => {
    expect(headlineParts(make({}), "mid")).toEqual([
      { key: "headline.mid.state", values: { state: "range" } },
      { key: "headline.mid.note", values: { long: "down", state: "range", days: 6 } },
    ]);
  });
  it("mid crash uses the shock variant", () => {
    const r = make({ mid: { state: "crash", since: "2026-11-10", days: 3 } });
    expect(headlineParts(r, "mid")).toEqual([
      { key: "headline.mid.state", values: { state: "crash" } },
      { key: "headline.mid.shock", values: { state: "crash", days: 3 } },
    ]);
  });
  it("mid without long", () => {
    const r = make({ long: null });
    expect(headlineParts(r, "mid")[1]).toEqual({
      key: "headline.mid.note",
      values: { long: "none", state: "range", days: 6 },
    });
  });
  it("mid null", () => {
    expect(headlineParts(make({ mid: null }), "mid")).toEqual([]);
  });
  it("near", () => {
    expect(headlineParts(make({}), "near")).toEqual([
      { key: "headline.near.sentence", values: { kind: "down", pct: "−16" } },
      { key: "headline.near.from_to", values: { from: "81,682", to: "68,314" } },
    ]);
  });
});

describe("near.ret_30d_pct missing", () => {
  const noRet = (over: Record<string, unknown> = {}) =>
    make({ near: { state: "down", since: "2026-10-31", days: 14, close: 68314.01, ...over } as One["near"] });
  it("derives it from close / close_30d_ago", () => {
    const r = noRet({ close_30d_ago: 81682.01 }); // −16.4%
    expect(headlineParts(r, "long")[1].values).toEqual({ pct: "−16" });
    expect(chipParts(r).near!.value.values).toEqual({ pct: "−16" });
  });
  it("never renders ±0 for a missing value: marks it none", () => {
    const r = noRet();
    expect(headlineParts(r, "long")[1].values).toEqual({ pct: "none" });
    expect(headlineParts(r, "near")[0].values).toEqual({ kind: "down", pct: "none" });
    expect(chipParts(r).near!.value.values).toEqual({ pct: "none" });
    expect(chipParts(r).near!.note.key).toBe("chip.note.near_nofrom");
    expect(JSON.stringify([headlineParts(r, "long"), chipParts(r).near])).not.toContain("±");
  });
});

describe("chipParts", () => {
  it("long down", () => {
    const c = chipParts(make({})).long!;
    expect(c.label).toEqual({ key: "chip.label.long", values: {} });
    expect(c.value).toEqual({ key: "chip.value.long.down", values: {} });
    expect(c.note).toEqual({
      key: "chip.note.long.down",
      values: {
        ath: "124,659",
        athDate: "2025-10-06",
        athYear: "2025",
        athMonth: 10,
        athDay: 6,
        pct: "−45",
        sinceMonth: 2,
        sinceDay: 2,
      },
    });
  });
  it("long down, today above the closed-bar high: no minus", () => {
    const c = chipParts(
      make({ long: longOf("down", { ath: { date: "2025-10-06", close: 124659, pct_from_ath: 1.5 } }) }),
    ).long!;
    expect(c.note.key).toBe("chip.note.long.down_newhigh");
    expect(JSON.stringify(c.note.values)).not.toContain("−");
  });
  it("long up", () => {
    const c = chipParts(make({ long: longOf("up") })).long!;
    expect(c.note.key).toBe("chip.note.long.up");
    expect(c.note.values).toMatchObject({ sinceMonth: 2, sinceDay: 2 });
  });
  it("long up but last weekly close at or below the 100-week line", () => {
    const c = chipParts(make({ long: longOf("up", { last_close: 80000 }) })).long!;
    expect(c.note).toEqual({
      key: "chip.note.long.up_below",
      values: { w100: "88,000", sinceMonth: 2, sinceDay: 2 },
    });
    const above = chipParts(make({ long: longOf("up", { last_close: 95000 }) })).long!;
    expect(above.note.key).toBe("chip.note.long.up");
  });
  it("long recovering with / without trough", () => {
    const withT = chipParts(make({ long: longOf("recovering") })).long!;
    expect(withT.note).toEqual({
      key: "chip.note.long.recovering",
      values: { troughMonth: 2, w100: "88,000", ath: "124,659", pct: "−45", sinceMonth: 2, sinceDay: 2 },
    });
    const noT = chipParts(make({ long: longOf("recovering", { trough: null }) })).long!;
    expect(noT.note).toEqual({
      key: "chip.note.long.recovering_notrough",
      values: { w100: "88,000", ath: "124,659", pct: "−45", sinceMonth: 2, sinceDay: 2 },
    });
  });
  it("long null -> null chip, others stay", () => {
    const c = chipParts(make({ long: null }));
    expect(c.long).toBeNull();
    expect(c.mid).not.toBeNull();
    expect(c.near).not.toBeNull();
  });

  const states = ["range", "calm", "up", "down", "crash", "surge"] as const;
  const longs = ["up", "down", "recovering"] as const;
  for (const l of longs) {
    for (const s of states) {
      it(`mid ${s} x long ${l}`, () => {
        const c = chipParts(
          make({ long: longOf(l), mid: { state: s, since: "2026-11-08", days: 6 } }),
        ).mid!;
        expect(c.value).toEqual({ key: `chip.value.mid.${s}`, values: {} });
        expect(c.note).toEqual({ key: `chip.mid.${l}.${s}`, values: { days: 6 } });
      });
    }
  }
  it("mid without long uses 'none'", () => {
    const c = chipParts(make({ long: null })).mid!;
    expect(c.note.key).toBe("chip.mid.none.range");
  });

  it("near", () => {
    const c = chipParts(make({})).near!;
    expect(c.value).toEqual({ key: "chip.value.near.down", values: { pct: "−16" } });
    expect(c.note).toEqual({
      key: "chip.note.near",
      values: { from: "81,682", to: "68,314", days: 14 },
    });
  });
});

describe("shockParts (§10.6)", () => {
  const shock = (n: number, kind: "crash" | "surge", long_state: Long["state"]) =>
    make({
      long: longOf(long_state),
      mid: { state: kind, since: "2026-11-10", days: 3 },
      shock: { kind, long_state, n, new_extreme_30d: 5, higher_30d: 4, start_day: "2026-11-10" },
    });
  it("n >= 10", () => {
    expect(shockParts(shock(13, "crash", "down"))).toEqual({
      key: "shock.many",
      values: { kind: "crash", long: "down", n: 13, newExtreme: 5, higher: 4, same: "no" },
    });
  });
  it("n 5..9 (BTC down x crash = 6 / 5 / 4)", () => {
    const s = shockParts(
      make({
        mid: { state: "crash", since: "2026-11-10", days: 3 },
        shock: { kind: "crash", long_state: "down", n: 6, new_extreme_30d: 5, higher_30d: 4, start_day: null },
      }),
    )!;
    expect(s).toEqual({
      key: "shock.few",
      values: { kind: "crash", long: "down", n: 6, newExtreme: 5, higher: 4, same: "no" },
    });
  });
  it("n 0..4 and boundaries", () => {
    expect(shockParts(shock(4, "surge", "up"))!.key).toBe("shock.none");
    expect(shockParts(shock(5, "surge", "up"))!.key).toBe("shock.few");
    expect(shockParts(shock(9, "surge", "up"))!.key).toBe("shock.few");
    expect(shockParts(shock(10, "surge", "up"))!.key).toBe("shock.many");
    expect(shockParts(shock(0, "crash", "recovering"))).toEqual({
      key: "shock.none",
      values: { kind: "crash", long: "recovering", n: 0, newExtreme: 5, higher: 4, same: "no" },
    });
  });
  it("null when no shock", () => {
    expect(shockParts(make({}))).toBeNull();
  });
});

describe("overviewParts", () => {
  const btc = make({ long: longOf("down"), near: nearOf("down", -16) });
  it("same states", () => {
    const eth = make({ long: longOf("down"), near: nearOf("down", -20) });
    expect(overviewParts({ BTC: btc, ETH: eth })).toEqual([
      { key: "overview.long.same", values: { assets: "BTC,ETH", first: "BTC", last: "ETH", state: "down" } },
      { key: "overview.near.same", values: { kind: "down" } },
    ]);
  });
  it("three assets with different states fall back to each", () => {
    const eth = make({ long: longOf("recovering") });
    const parts = overviewParts({ BTC: btc, ETH: eth, SOL: make({ long: longOf("up") }) });
    expect(parts.filter((p) => p.key === "overview.long.each")).toHaveLength(3);
  });
  it("different states", () => {
    const eth = make({ long: longOf("recovering"), near: nearOf("down", -20) });
    expect(overviewParts({ BTC: btc, ETH: eth })).toEqual([
      {
        key: "overview.long.pair",
        values: { first: "BTC", firstState: "down", last: "ETH", lastState: "recovering" },
      },
      { key: "overview.near.same", values: { kind: "down" } },
    ]);
    const eth2 = make({ long: longOf("down"), near: nearOf("up", 5) });
    expect(overviewParts({ BTC: btc, ETH: eth2 })[1]).toEqual({
      key: "overview.near.each",
      values: { asset: "BTC", kind: "down" },
    });
  });
});

describe("sinceDay (since_week の翌日)", () => {
  it("2026-02-01 -> 2/2", () => expect(sinceDay("2026-02-01")).toEqual({ m: 2, d: 2 }));
  it("2026-08-23 -> 8/24", () => expect(sinceDay("2026-08-23")).toEqual({ m: 8, d: 24 }));
  it("2026-01-31 -> 2/1 (month rollover)", () =>
    expect(sinceDay("2026-01-31")).toEqual({ m: 2, d: 1 }));
});
