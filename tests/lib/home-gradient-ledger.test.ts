import { describe, expect, it } from "vitest";
import {
  GRADIENT_REGIONS,
  REGION_MODULES,
  INDEX_NAV_MODULES,
} from "@/lib/home/gradient-ledger";

describe("gradient ledger", () => {
  it("defines the four regions in DOM order", () => {
    expect(GRADIENT_REGIONS).toEqual(["hero", "leading", "coincident", "lagging"]);
  });
  it("defines module order per region (doctrine §4 gradient ledger)", () => {
    expect(REGION_MODULES.hero).toEqual(["hero-session-line", "hero-lead-headline"]);
    // 2026-08-14 Phase 3 (田平氏 GO): event-risk を schedule 直下・観測リストを
    // radar-observations として独立・mkt12-reading を lead-article 直下へ。
    expect(REGION_MODULES.leading).toEqual([
      "session-now", "schedule", "event-risk", "flash-promotion",
      "radar-observations", "focus",
    ]);
    expect(REGION_MODULES.coincident).toEqual([
      "lead-article", "mkt12-reading", "signal-timeline", "mkt12-tiles", "lane-values",
    ]);
    expect(REGION_MODULES.lagging).toEqual([
      "deep-dive", "atlas-entry", "mkt12-weekend", "weekly-brief", "latest-articles",
      "turning-point-reserved",
    ]);
  });
  it("marks index-nav modules (dedup-exempt)", () => {
    expect(INDEX_NAV_MODULES).toEqual([
      "hero-session-line", "hero-lead-headline",
      "atlas-entry", "mkt12-weekend", "weekly-brief", "latest-articles",
    ]);
  });
});
