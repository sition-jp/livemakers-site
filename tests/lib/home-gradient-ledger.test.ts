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
    expect(REGION_MODULES.leading).toEqual([
      "session-now", "schedule", "flash-promotion", "focus", "event-risk",
    ]);
    expect(REGION_MODULES.coincident).toEqual([
      "lead-article", "signal-timeline", "mkt12-tiles", "mkt12-reading", "lane-values",
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
