import { describe, expect, it } from "vitest";
import {
  blockedTerminalAdapterFixture,
  degradedTerminalAdapterFixture,
  readyTerminalAdapterFixture,
  unavailableTerminalAdapterFixture,
} from "@/lib/livemakers-terminal-adapter/fixtures";
import type { TerminalAdapterPacket } from "@/lib/livemakers-terminal-adapter/types";
import { TerminalAdapterPacketSchema } from "@/lib/livemakers-terminal-adapter/types";
import {
  collectTerminalVisibleCopy,
  findForbiddenTerminalVisibleTerms,
} from "@/lib/livemakers-terminal-adapter/visible-copy-safety";

const fixtures = [
  readyTerminalAdapterFixture,
  degradedTerminalAdapterFixture,
  unavailableTerminalAdapterFixture,
  blockedTerminalAdapterFixture,
];

function cloneFixture(fixture = readyTerminalAdapterFixture): TerminalAdapterPacket {
  return JSON.parse(JSON.stringify(fixture)) as TerminalAdapterPacket;
}

describe("TerminalAdapterPacketSchema synthetic fixtures", () => {
  it("accepts ready, degraded, unavailable, and blocked synthetic packets", () => {
    for (const fixture of fixtures) {
      const result = TerminalAdapterPacketSchema.safeParse(fixture);
      expect(result.success, JSON.stringify(result.error?.format(), null, 2)).toBe(true);
    }
  });

  it("keeps synthetic fixture visible copy away from trading and execution language", () => {
    for (const fixture of fixtures) {
      expect(findForbiddenTerminalVisibleTerms(fixture)).toEqual([]);
    }
  });

  it("keeps degraded, unavailable, and blocked fixture states explicit", () => {
    expect(collectTerminalVisibleCopy(degradedTerminalAdapterFixture)).toContain(
      "Stale fixture",
    );
    expect(collectTerminalVisibleCopy(unavailableTerminalAdapterFixture)).toContain(
      "Unavailable",
    );
    expect(blockedTerminalAdapterFixture.modules[0].payload).toEqual({});
  });

  it("does not scan internal contract field names as visible copy", () => {
    const packet = cloneFixture();
    packet.modules[0].payload = {
      paper_live: "Internal key name only",
      display_en: "Safe public label",
    };

    expect(findForbiddenTerminalVisibleTerms(packet)).toEqual([]);
  });

  it("rejects modules that reference missing source ledger entries", () => {
    const packet = cloneFixture();
    packet.modules[0].source_refs = ["missing.source"];

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });

  it("rejects reviewed-content modules without reviewed_at", () => {
    const packet = cloneFixture();
    packet.modules[0].content_kind = "scenario";
    packet.modules[0].reviewed_at = null;

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });

  it("rejects approved modules backed by unverified or internal-only sources", () => {
    const packet = cloneFixture();
    packet.modules[0].source_confidence = "unverified";

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });

  it("rejects private sources marked as public-display allowed", () => {
    const packet = cloneFixture();
    packet.source_ledger[0].source_visibility = "private";
    packet.source_ledger[0].public_display_allowed = true;

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });

  it("rejects any module that allows advice language", () => {
    const packet = cloneFixture();
    packet.modules[0].value_policy.may_show_advice_language = true;

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });

  it("detects forbidden visible trading and execution language", () => {
    const packet = cloneFixture();
    packet.modules[0].payload = {
      headline_en: "Actionable signal: buy pressure",
    };

    expect(findForbiddenTerminalVisibleTerms(packet)).not.toEqual([]);
  });

  it("rejects packets when a prohibited coupling check is false", () => {
    const packet = cloneFixture();
    packet.safety.prohibited_couplings_checked.paper_live = false;

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });

  it("rejects blocked modules that still contain renderable payload values", () => {
    const packet = cloneFixture(blockedTerminalAdapterFixture);
    packet.modules[0].payload = {
      headline_en: "Blocked content should not render",
    };

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });

  it("rejects missing numeric values rendered as zero under unavailable_not_zero", () => {
    const packet = cloneFixture();
    packet.modules[0].value_policy.may_show_numeric_value = true;
    packet.modules[0].null_policy = "unavailable_not_zero";
    packet.modules[0].payload = {
      numeric_value_missing: true,
      value_display: "0",
    };

    expect(TerminalAdapterPacketSchema.safeParse(packet).success).toBe(false);
  });
});
