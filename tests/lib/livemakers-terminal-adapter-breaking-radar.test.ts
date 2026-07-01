import { describe, expect, it } from "vitest";
import { breakingRadarAdapterFixture } from "@/lib/livemakers-terminal-adapter/breaking-radar-fixture";
import { TerminalAdapterPacketSchema } from "@/lib/livemakers-terminal-adapter/types";
import { findForbiddenTerminalVisibleTerms } from "@/lib/livemakers-terminal-adapter/visible-copy-safety";

describe("breaking radar adapter fixture", () => {
  it("is a degraded adapter packet for the G1 Breaking Radar fixture sample", () => {
    const result = TerminalAdapterPacketSchema.safeParse(breakingRadarAdapterFixture);

    expect(result.success, JSON.stringify(result.error?.format(), null, 2)).toBe(true);
    expect(breakingRadarAdapterFixture.packet_id).toBe(
      "fixture.breaking_radar_adapter.2026_07_01.sample_g1",
    );
    expect(breakingRadarAdapterFixture.packet_status).toBe("degraded");
    expect(breakingRadarAdapterFixture.as_of_jst).toBe(
      "2026-07-01T13:55:53+09:00",
    );
  });

  it("keeps visible copy free of trading, execution, paper, and live wording", () => {
    expect(findForbiddenTerminalVisibleTerms(breakingRadarAdapterFixture)).toEqual([]);
  });

  it("normalizes Breaking Radar sources into adapter-safe fixture sources", () => {
    expect(breakingRadarAdapterFixture.source_ledger.map((source) => source.source_id)).toEqual([
      "source.breaking_radar.xnews_fixture",
      "source.breaking_radar.personalized_trend_fixture",
      "source.breaking_radar.scheduled_crosscheck",
      "source.breaking_radar.manual_snapshot_internal",
    ]);
    expect(
      breakingRadarAdapterFixture.source_ledger.every(
        (source) => source.source_kind === "fixture",
      ),
    ).toBe(true);
  });

  it("creates only the three displayable modules and resolves their source refs", () => {
    expect(breakingRadarAdapterFixture.modules.map((module) => module.module_id)).toEqual([
      "breaking_radar.what_happened.bank_capital",
      "breaking_radar.leading_indicators.ai_capacity",
      "breaking_radar.leading_indicators.protocol_status",
    ]);

    const sourceIds = new Set(
      breakingRadarAdapterFixture.source_ledger.map((source) => source.source_id),
    );

    for (const module of breakingRadarAdapterFixture.modules) {
      expect(module.module_status).toBe("degraded");
      expect(module.public_display_safety).toBe("needs_review");
      expect(module.reviewed_at).toBe("2026-07-01T17:13:56+09:00");
      expect(module.value_policy).toEqual({
        may_show_numeric_value: false,
        may_show_directional_language: false,
        may_show_advice_language: false,
      });

      for (const sourceRef of module.source_refs) {
        expect(sourceIds.has(sourceRef), `${module.module_id} -> ${sourceRef}`).toBe(true);
      }
    }
  });

  it("keeps manual snapshot provenance internal and non-public", () => {
    const manualSnapshotSource = breakingRadarAdapterFixture.source_ledger.find(
      (source) => source.source_id === "source.breaking_radar.manual_snapshot_internal",
    );

    expect(manualSnapshotSource?.source_visibility).toBe("internal_path");
    expect(manualSnapshotSource?.source_confidence).toBe("internal_only");
    expect(manualSnapshotSource?.public_display_allowed).toBe(false);
  });

  it("keeps operator-only candidate text out of serialized adapter output", () => {
    const serialized = JSON.stringify(breakingRadarAdapterFixture);

    expect(serialized).not.toContain("Duplicate macro item already exists in scheduled session");
    expect(serialized).not.toContain("Account-personalized raw capture is blocked");
    expect(serialized).not.toContain("source.manual_snapshot.fixture.001");
    expect(serialized).not.toContain("account-specific context");
    expect(serialized).not.toContain("credentials");
    expect(serialized).not.toContain("DMs");
  });
});
