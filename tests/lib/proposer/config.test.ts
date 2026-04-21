import { describe, it, expect } from "vitest";
import { PROPOSER_CONFIG } from "@/lib/proposer/config";

describe("PROPOSER_CONFIG", () => {
  it("has min_cluster_size=2", () => {
    expect(PROPOSER_CONFIG.min_cluster_size).toBe(2);
  });
  it("has min_avg_confidence=0.60", () => {
    expect(PROPOSER_CONFIG.min_avg_confidence).toBe(0.60);
  });
  it("has time_window_hours=72", () => {
    expect(PROPOSER_CONFIG.time_window_hours).toBe(72);
  });
  it("supports BTC / ETH / ADA / NIGHT", () => {
    expect(PROPOSER_CONFIG.supported_assets).toEqual(["BTC", "ETH", "ADA", "NIGHT"]);
  });
  it("excludes mixed direction", () => {
    expect(PROPOSER_CONFIG.excluded_cluster_directions).toContain("mixed");
  });
  it("max_proposals_per_night=3", () => {
    expect(PROPOSER_CONFIG.max_proposals_per_night).toBe(3);
  });
  it("threshold_pct covers 4 horizons", () => {
    expect(Object.keys(PROPOSER_CONFIG.threshold_pct).sort()).toEqual(
      ["intraday", "multi-week", "position", "swing"],
    );
  });
  it("expire_after_hours=24", () => {
    expect(PROPOSER_CONFIG.expire_after_hours).toBe(24);
  });
});
