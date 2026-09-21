import { describe, expect, it } from "vitest";
import { buildNavModel } from "@/lib/home/nav-model";

describe("buildNavModel", () => {
  it("keeps 9 dropdown items (flash first) and no top-level atlas while unpublished (G46 §11.3)", () => {
    const nav = buildNavModel(false);
    expect(nav.articlesGroup.map((i) => i.key)).toEqual([
      "flash",
      "dailyIntel",
      "signal",
      "deepDive",
      "mkt12Morning",
      "mkt12Weekend",
      "eventRiskRadar",
      "weeklyBrief",
      "futureMap",
    ]);
    expect(nav.articlesGroup.find((i) => i.key === "futureMap")?.href).toBe(
      "/articles/series/future-map",
    );
    // 2026-09-21 田平氏 GO (案 1): 速報はナビ先頭 (トップ帯と対) — series page へ
    expect(nav.articlesGroup[0].href).toBe("/articles/series/flash");
    expect(nav.topLevel.map((i) => i.key)).toEqual(["sessionTerminal", "about"]);
  });

  it("promotes atlas to top level and drops future-map in the same derivation when published", () => {
    const nav = buildNavModel(true);
    expect(nav.articlesGroup).toHaveLength(8);
    expect(nav.articlesGroup.some((i) => i.key === "futureMap")).toBe(false);
    // Phase 3 (2026-08-14): sessionTerminal (= Intelligence Terminal) が先頭
    expect(nav.topLevel.map((i) => i.key)).toEqual([
      "sessionTerminal",
      "futureAtlas",
      "about",
    ]);
    expect(nav.topLevel[0].href).toBe("/sessions/archive");
    expect(nav.topLevel[1].href).toBe("/future-atlas");
  });

  it("keeps the weekly brief pointing at /brief (spec §8-4)", () => {
    for (const surfacePublished of [false, true]) {
      const nav = buildNavModel(surfacePublished);
      expect(nav.articlesGroup.find((i) => i.key === "weeklyBrief")?.href).toBe(
        "/brief",
      );
    }
  });
});
