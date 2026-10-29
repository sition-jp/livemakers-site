import { describe, expect, it } from "vitest";

import {
  CONFIRMED_RESTART_STAGES,
  RESTART_TRACKS,
  restartStageSummary,
} from "@/lib/restart-map/stages";

describe("restart-map confirmed stages", () => {
  it("summarizes issue #1 as the stress track plus the range of the other six", () => {
    expect(restartStageSummary("restart-map-20261026-3539f54e")).toBe(
      "③ 旧システムの負荷 = 緊張 ／ ほか 6 系統は兆し〜実験",
    );
  });

  it("returns null for an issue whose stages are not in the table yet", () => {
    // 新しい号の段階が表に入るまでは、前の号の段階を出さない (行ごと出さない)
    expect(restartStageSummary("restart-map-20261126-deadbeef")).toBeNull();
  });

  it("names a single stage when all six growth tracks share it", () => {
    const stages = Object.fromEntries(
      RESTART_TRACKS.map((track) => [track.key, 2]),
    );
    expect(
      restartStageSummary("x", { x: { ...stages, legacy_stress: 2 } }),
    ).toBe("③ 旧システムの負荷 = 負荷 ／ ほか 6 系統は実験");
  });

  it("keeps every confirmed issue complete (7 tracks, stages 1-4)", () => {
    for (const stages of Object.values(CONFIRMED_RESTART_STAGES)) {
      expect(Object.keys(stages).toSorted()).toEqual(
        RESTART_TRACKS.map((track) => track.key).toSorted(),
      );
      for (const value of Object.values(stages)) {
        expect([1, 2, 3, 4]).toContain(value);
      }
    }
  });
});
