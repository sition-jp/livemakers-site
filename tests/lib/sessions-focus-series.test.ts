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
    // fixture は 0 件になったので、窓判定は注入レコードで検証する
    const records = [
      { instrumentId: "nikkei_futures", atJst: "2026-07-09T06:00:00+09:00", value: 68000 }, // 窓外 (25h58m 前)
      { instrumentId: "nikkei_futures", atJst: "2026-07-09T12:03:00+09:00", value: 68020 },
      { instrumentId: "nikkei_futures", atJst: "2026-07-09T23:03:00+09:00", value: 68480 },
      { instrumentId: "nikkei_futures", atJst: "2026-07-10T07:30:00+09:00", value: 69035 },
    ];
    const series = buildFocusSeries(
      records,
      "nikkei_futures",
      { windowEndJst: "2026-07-10T07:58:00+09:00" },
    );
    expect(series).not.toBeNull();
    expect(series?.points).toHaveLength(3);
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

  it("the shipped fixture holds no records, so no chart renders from it", () => {
    expect(loadFocusSeriesRecords()).toEqual([]);
  });

  it("returns null when fewer than two points exist", () => {
    expect(
      buildFocusSeries([], "us10y", {
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
