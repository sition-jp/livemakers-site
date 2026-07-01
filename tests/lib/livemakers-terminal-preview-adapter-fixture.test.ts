import { describe, expect, it } from "vitest";
import { readerTerminalPublicAdapterFixture } from "@/lib/livemakers-terminal-adapter/reader-terminal-public-fixture";
import type { TerminalAdapterPacket } from "@/lib/livemakers-terminal-adapter/types";
import { TerminalAdapterPacketSchema } from "@/lib/livemakers-terminal-adapter/types";
import { findForbiddenTerminalVisibleTerms } from "@/lib/livemakers-terminal-adapter/visible-copy-safety";
import {
  buildTerminalPreviewMockFromAdapterFixture,
  terminalPreviewAdapterFixtureMock,
  terminalPreviewAdapterFixturePacket,
} from "@/lib/livemakers-terminal-preview/adapter-fixture-data";
import { terminalPreviewMock } from "@/lib/livemakers-terminal-preview/mock-data";

function clonePacket(packet = readerTerminalPublicAdapterFixture): TerminalAdapterPacket {
  return JSON.parse(JSON.stringify(packet)) as TerminalAdapterPacket;
}

describe("terminal preview adapter fixture bridge", () => {
  it("exports a schema-valid adapter fixture packet with safe visible copy", () => {
    const parsed = TerminalAdapterPacketSchema.safeParse(
      terminalPreviewAdapterFixturePacket,
    );

    expect(parsed.success, JSON.stringify(parsed.error?.format(), null, 2)).toBe(
      true,
    );
    expect(terminalPreviewAdapterFixturePacket.packet_id).toBe(
      "fixture.reader_terminal_public_topology.2026_07_01.g31",
    );
    expect(terminalPreviewAdapterFixturePacket.packet_status).toBe("degraded");
    expect(terminalPreviewAdapterFixturePacket.as_of_jst).toBe(
      "2026-07-01T13:55:53+09:00",
    );
    expect(findForbiddenTerminalVisibleTerms(terminalPreviewAdapterFixturePacket)).toEqual(
      [],
    );
  });

  it("derives hidden preview source ledger and modules from the adapter packet", () => {
    expect(terminalPreviewAdapterFixtureMock.routePolicy).toEqual({
      hidden: true,
      navLink: false,
      noindex: true,
    });
    expect(terminalPreviewAdapterFixtureMock.terminalState.asOfJst).toBe(
      readerTerminalPublicAdapterFixture.as_of_jst,
    );
    expect(terminalPreviewAdapterFixtureMock.terminalState.label).toEqual({
      en: "Market State",
      ja: "マーケット状態",
    });
    expect(
      terminalPreviewAdapterFixtureMock.sourceLedger.map((source) => source.id),
    ).toEqual([
      "source.reader_terminal.onchain_fixture",
      "source.breaking_radar.xnews_fixture",
      "source.breaking_radar.personalized_trend_fixture",
      "source.breaking_radar.scheduled_crosscheck",
    ]);
    expect(
      terminalPreviewAdapterFixtureMock.modules.map((module) => module.moduleId),
    ).toEqual([
      "reader_terminal.live_data_strip.onchain_state",
      "breaking_radar.what_happened.bank_capital",
      "breaking_radar.leading_indicators.ai_capacity",
      "breaking_radar.leading_indicators.protocol_status",
    ]);
    expect(
      terminalPreviewAdapterFixtureMock.indicators.map((indicator) => indicator.id),
    ).toContain("reader_terminal.live_data_strip.onchain_state");

    const visibleCopy = JSON.stringify(terminalPreviewAdapterFixtureMock.visibleCopy);
    expect(visibleCopy).not.toContain("source.breaking_radar.manual_snapshot_internal");
    expect(visibleCopy).not.toContain("Breaking Radar manual snapshot internal fixture");
    expect(visibleCopy).not.toContain("Duplicate macro item already exists in scheduled session");
    expect(visibleCopy).not.toContain("Account-personalized raw capture is blocked");
    expect(visibleCopy).not.toContain("credentials");
    expect(visibleCopy).not.toContain("DMs");
  });

  it("keeps every bridged preview module synthetic and disconnected from runtime couplings", () => {
    for (const module of terminalPreviewAdapterFixtureMock.modules) {
      expect(module.sourceKind).toBe("fixture_only");
      expect(module.sourceConfidence).toBe("mock");
      expect(module.publicDisplaySafety).toBe("mock_only");
      expect(module.realDataConnection).toBe(false);
      expect(module.prohibitedCouplingsChecked).toEqual({
        tradingSignal: true,
        orderInstruction: true,
        paperLive: true,
        atFeedback: true,
        secrets: true,
      });
    }
  });

  it("places on-chain state in the Terminal current-state strip, not the Live Radar titles", () => {
    const onchainModule = terminalPreviewAdapterFixturePacket.modules.find(
      (module) => module.module_id === "reader_terminal.live_data_strip.onchain_state",
    );

    expect(onchainModule?.display_surface).toBe("live_data_strip");
    expect(onchainModule?.data_family).toBe("crypto_onchain");

    const radarTitles = terminalPreviewAdapterFixtureMock.publicTopology.liveRadar.items.map(
      (item) => item.title.en,
    );
    expect(radarTitles).not.toContain("On-chain state");
  });

  it("rejects adapter packets with forbidden visible trading or execution copy", () => {
    const packet = clonePacket();
    packet.modules[0].payload = {
      headline_en: "Actionable signal: buy pressure",
    };

    expect(() =>
      buildTerminalPreviewMockFromAdapterFixture(packet, terminalPreviewMock),
    ).toThrow(/forbidden terminal visible copy/i);
  });

  it("rejects adapter packets that fail schema validation", () => {
    const packet = clonePacket();
    packet.modules[0].source_refs = ["missing.source"];

    expect(() =>
      buildTerminalPreviewMockFromAdapterFixture(packet, terminalPreviewMock),
    ).toThrow(/invalid terminal adapter packet/i);
  });

  it("rejects adapter packets with false prohibited coupling checks", () => {
    const packet = clonePacket();
    packet.safety.prohibited_couplings_checked.paper_live = false;

    expect(() =>
      buildTerminalPreviewMockFromAdapterFixture(packet, terminalPreviewMock),
    ).toThrow(/invalid terminal adapter packet/i);
  });
});
