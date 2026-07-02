import { describe, expect, it } from "vitest";
import { getScheduledSessionVisibility } from "@/lib/livemakers-terminal-preview/scheduled-session-visibility";

describe("scheduled session reader visibility", () => {
  it("projects the G6b scheduled-session fixture into reader-visible status items", () => {
    const visibility = getScheduledSessionVisibility();

    expect(visibility.sourcePacketId).toBe(
      "fixture.scheduled_session_visibility.2026_06_25_asia_open",
    );
    expect(visibility.sessionSlug).toBe("asia_open");
    expect(visibility.internalSlot).toBe("morning");
    expect(visibility.asOfJst).toBe("2026-06-25T07:18:02+09:00");
    expect(visibility.items.map((item) => item.status)).toEqual([
      "classified",
      "surface_ready",
      "verify_next",
      "signal_seed",
      "already_covered",
    ]);
    expect(visibility.items.map((item) => item.sourceItemId)).toEqual([
      "vis_004_cross_asset_risk_classified",
      "vis_001_fed_stress_test_surface_ready",
      "vis_002_cardano_hf_verify_next",
      "vis_003_ai_inference_cost_signal_seed",
      "vis_006_duplicate_fed_row_already_covered",
    ]);
    expect(visibility.items.map((item) => item.family)).toEqual([
      "market",
      "macro_liquidity",
      "other",
      "ai_capital_cycle",
      "editorial",
    ]);
  });

  it("keeps session visibility non-clickable and non-publishing", () => {
    const visibility = getScheduledSessionVisibility();

    expect(visibility.items.every((item) => item.href === null)).toBe(true);
    expect(
      visibility.items.every(
        (item) => item.publishDecision === "not_authorized",
      ),
    ).toBe(true);
    expect(visibility.items.map((item) => item.reasonCode)).toEqual([
      "source_backed_account_relevant",
      "source_backed_account_relevant",
      "primary_source_required",
      "deferred_to_signal_or_deep_dive",
      "already_covered_same_angle",
    ]);
  });

  it("does not expose internal paths, queues, or publication logs", () => {
    const serialized = JSON.stringify(getScheduledSessionVisibility());

    expect(serialized).not.toContain("/Users/");
    expect(serialized).not.toContain("07_DATA");
    expect(serialized).not.toContain("site_publish_log");
    expect(serialized).not.toContain("published_log");
    expect(serialized).not.toContain("article_queue");
    expect(serialized).not.toContain("publish_audit");
    expect(serialized).not.toContain("publish_candidates");
    expect(serialized).not.toContain("internal_sde_state");
    expect(serialized).not.toContain("internal_only");
    expect(serialized).not.toContain("source.g6b_control_plane_fixture");
    expect(serialized).not.toContain("/api/");
    expect(serialized).not.toContain("process.env");
    expect(serialized).not.toContain("fetch(");
  });
});
