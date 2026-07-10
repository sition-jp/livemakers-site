import { describe, expect, it } from "vitest";

import {
  buildFocusSeries,
  loadFocusSeriesRecords,
  resolveFocusInstruments,
} from "@/lib/sessions/focus-series";
import { getSessionRecord } from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";

describe("focus series contract (G-e / D3)", () => {
  it("builds update-point steps inside the 24-hour window", () => {
    const series = buildFocusSeries(
      loadFocusSeriesRecords(),
      "nikkei_futures",
      { windowEndJst: "2026-07-10T07:58:00+09:00" },
    );
    expect(series).not.toBeNull();
    expect(series?.points.length).toBeGreaterThanOrEqual(2);
    expect(series?.points.length).toBeLessThanOrEqual(6);
    expect(series?.seriesPacketId).toBe(
      "series.2026-07-10.nikkei_futures",
    );
    const first = series!.points[0].value;
    const last = series!.points.at(-1)!.value;
    expect(series?.changeFromBasePct).toBeCloseTo(
      ((last - first) / first) * 100,
      6,
    );
  });

  it("returns null when fewer than two points exist", () => {
    expect(
      buildFocusSeries([], "vix", {
        windowEndJst: "2026-07-10T07:58:00+09:00",
      }),
    ).toBeNull();
  });

  it("uses valid sidecar instruments and session defaults otherwise", () => {
    const live = getSessionRecord("2026-07-10-asia-open");
    expect(resolveFocusInstruments(live)).toEqual([
      "nikkei_futures",
      "usd_jpy",
      "btc_usd",
    ]);
    const broken = {
      ...live,
      focusInstruments: ["nikkei_futures"] as typeof live.focusInstruments,
    };
    expect(resolveFocusInstruments(broken)).toEqual(
      getSessionBySlug("asia-open").defaultFocusInstruments,
    );
  });
});
