import { describe, expect, it } from "vitest";
import { scheduledSessionVisibilityAdapterFixture } from "@/lib/livemakers-terminal-adapter/scheduled-session-visibility-fixture";
import { TerminalAdapterPacketSchema } from "@/lib/livemakers-terminal-adapter/types";
import { findForbiddenTerminalVisibleTerms } from "@/lib/livemakers-terminal-adapter/visible-copy-safety";

describe("scheduled session visibility adapter fixture", () => {
  it("is a degraded adapter packet for the 2026-06-25 Asia Open scheduled-session ledger", () => {
    const result = TerminalAdapterPacketSchema.safeParse(scheduledSessionVisibilityAdapterFixture);

    expect(result.success, JSON.stringify(result.error?.format(), null, 2)).toBe(true);
    expect(scheduledSessionVisibilityAdapterFixture.packet_id).toBe(
      "fixture.scheduled_session_visibility.2026_06_25_asia_open",
    );
    expect(scheduledSessionVisibilityAdapterFixture.packet_status).toBe("degraded");
    expect(scheduledSessionVisibilityAdapterFixture.as_of_jst).toBe(
      "2026-06-25T07:18:02+09:00",
    );
  });

  it("keeps visible copy free of trading, execution, paper, and live wording", () => {
    expect(findForbiddenTerminalVisibleTerms(scheduledSessionVisibilityAdapterFixture)).toEqual([]);
  });

  it("keeps every module source reference resolvable", () => {
    const sourceIds = new Set(
      scheduledSessionVisibilityAdapterFixture.source_ledger.map((source) => source.source_id),
    );

    for (const module of scheduledSessionVisibilityAdapterFixture.modules) {
      for (const sourceRef of module.source_refs) {
        expect(sourceIds.has(sourceRef), `${module.module_id} -> ${sourceRef}`).toBe(true);
      }
    }
  });

  it("keeps already-covered accounting blocked and non-renderable", () => {
    const blocked = scheduledSessionVisibilityAdapterFixture.modules.find(
      (module) => module.module_id === "scheduled.already_covered.blocked",
    );

    expect(blocked?.module_status).toBe("blocked");
    expect(blocked?.public_display_safety).toBe("blocked");
    expect(blocked?.payload).toEqual({});
  });

  it("keeps internal fixture provenance non-public and all prohibited couplings closed", () => {
    const fixtureSource = scheduledSessionVisibilityAdapterFixture.source_ledger.find(
      (source) => source.source_id === "source.g6b_control_plane_fixture",
    );

    expect(fixtureSource?.source_visibility).toBe("internal_path");
    expect(fixtureSource?.public_display_allowed).toBe(false);
    expect(scheduledSessionVisibilityAdapterFixture.safety.prohibited_couplings_checked).toEqual({
      trading_signal: true,
      order_instruction: true,
      paper_live: true,
      at_feedback: true,
      secrets: true,
    });
  });
});
