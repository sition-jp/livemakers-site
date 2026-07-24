import { describe, expect, it } from "vitest";
import { buildNavModel } from "@/lib/home/nav-model";

describe("buildNavModel", () => {
  it("keeps 8 dropdown items and no top-level atlas while unpublished (G46 §11.3)", () => {
    const nav = buildNavModel(false);
    expect(nav.articlesGroup.map((i) => i.key)).toEqual([
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
    expect(nav.topLevel.map((i) => i.key)).toEqual(["sessionTerminal", "about"]);
  });

  it("promotes atlas to top level and drops future-map in the same derivation when published", () => {
    const nav = buildNavModel(true);
    expect(nav.articlesGroup).toHaveLength(7);
    expect(nav.articlesGroup.some((i) => i.key === "futureMap")).toBe(false);
    expect(nav.topLevel.map((i) => i.key)).toEqual([
      "futureAtlas",
      "sessionTerminal",
      "about",
    ]);
    expect(nav.topLevel[0].href).toBe("/future-atlas");
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
