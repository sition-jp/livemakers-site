import { describe, expect, it } from "vitest";
import section from "../fixtures/landmark/section.json";
import { mapLandmarkMeter, type LandmarkMeterData } from "@/lib/landmark/meter-feed";
import { buildLandmarkRows, formatLongDate, formatShortDate } from "@/lib/landmark/meter-model";

const NOW = new Date("2026-10-16T10:45:00Z"); // 19:45 JST

function data(mutate?: (d: LandmarkMeterData) => void): LandmarkMeterData {
  const mapped = mapLandmarkMeter(structuredClone(section));
  if (!mapped) throw new Error("fixture must be valid");
  mutate?.(mapped);
  return mapped;
}

describe("buildLandmarkRows", () => {
  it("builds the six fixed rows with neutral badges from the real 2026-10-16 section", () => {
    const rows = buildLandmarkRows(data(), NOW);
    expect(rows?.map((row) => row.copyKey)).toEqual(["ma200w", "macd2w", "macd1m", "mvrv", "funding", "etf"]);
    expect(rows?.map((row) => row.badge)).toEqual(["cooldown", "afterCross", null, null, "cooldown", null]);
    expect(rows?.[3].recoverBadge).toBe("waitingPremise");
    expect(rows?.[5].staleEmphasis).toBe(true); // Farside の保存が 10/2 = 14 日前
    expect(rows?.[0].staleEmphasis).toBe(false);
  });

  it("marks a bar-based row as fired while its firing bar is the latest bar", () => {
    const rows = buildLandmarkRows(data((d) => { d.items[1].lastEvent = d.items[1].barDate; }), NOW);
    expect(rows?.[1].badge).toBe("fired");
  });

  it("marks a daily row as fired for 7 days after the event", () => {
    const within = buildLandmarkRows(data((d) => { d.items[4].lastEvent = "2026-10-10"; }), NOW);
    expect(within?.[4].badge).toBe("fired"); // 経過 6 日
    const after = buildLandmarkRows(data((d) => { d.items[4].lastEvent = "2026-10-09"; }), NOW); // 経過 7 日
    expect(after?.[4].badge).toBe("cooldown");
    const recovered = buildLandmarkRows(data((d) => { d.items[3].recover!.lastEvent = "2026-10-15"; }), NOW);
    expect(recovered?.[3].recoverBadge).toBe("fired");
  });

  it("re-checks freshness at render time and blanks only the stale row", () => {
    const rows = buildLandmarkRows(data((d) => { d.items[1].checkedAtJst = "2026-10-15T06:44:00+09:00"; }), NOW);
    expect(rows?.[1].item).toBeNull();
    expect(rows?.[1].badge).toBeNull();
    expect(rows?.[0].item).not.toBeNull();
    const etfOld = buildLandmarkRows(data((d) => { d.items[5].barDate = "2026-09-15"; }), NOW);
    expect(etfOld?.[5].item).toBeNull(); // 31 日前
    const dailyOld = buildLandmarkRows(data((d) => { d.items[4].barDate = "2026-10-12"; }), NOW);
    expect(dailyOld?.[4].item).toBeNull(); // 4 日前
  });

  it("keeps a row the feed does not carry as an empty row", () => {
    const rows = buildLandmarkRows(data((d) => { d.items = d.items.filter((i) => i.key !== "btc_etf_cum_high"); }), NOW);
    expect(rows).toHaveLength(6);
    expect(rows?.[5].item).toBeNull();
  });

  it("hides the meter when every item is stale at render time", () => {
    expect(buildLandmarkRows(data(), new Date("2026-10-18T12:00:00Z"))).toBeNull();
    expect(buildLandmarkRows(null, NOW)).toBeNull();
  });
});

describe("date formatting", () => {
  it("formats short and long Japanese dates", () => {
    expect(formatShortDate("2026-10-15")).toBe("10/15");
    expect(formatLongDate("2026-06-28")).toBe("2026年6月28日");
  });
});
