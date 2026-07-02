import { describe, expect, it } from "vitest";
import {
  getReviewedReaderTerminalSource,
  type ReviewedReaderTerminalSourceSnapshot,
} from "@/lib/livemakers-terminal-preview/reader-terminal-source";

describe("reviewed reader terminal source", () => {
  it("packages the reviewed reader-terminal fixture packet for homepage consumption", () => {
    const snapshot: ReviewedReaderTerminalSourceSnapshot =
      getReviewedReaderTerminalSource();

    expect(snapshot.sourceId).toBe(
      "reader_terminal.homepage.reviewed_fixture_source.g33",
    );
    expect(snapshot.sourceMode).toBe("fixture_only");
    expect(snapshot.reviewStatus).toBe("reviewed_fixture");
    expect(snapshot.packetId).toBe(
      "fixture.reader_terminal_public_topology.2026_07_01.g31",
    );
    expect(snapshot.generatedAt).toBe("2026-07-01T21:30:00+09:00");
    expect(snapshot.reviewedAt).toBe("2026-07-01T21:30:00+09:00");
    expect(snapshot.data.routePolicy).toEqual({
      hidden: true,
      navLink: false,
      noindex: true,
    });
    expect(snapshot.data.modules.length).toBeGreaterThan(0);
    expect(snapshot.data.modules.every((module) => module.realDataConnection === false)).toBe(
      true,
    );
    expect(snapshot.data.publicTopology.liveRadar.items.length).toBeGreaterThan(0);
    expect(snapshot.data.publicTopology.articleNewsFeed.items.length).toBeGreaterThan(0);
  });

  it("keeps source provenance fixture-only and does not expose runtime hooks", () => {
    const snapshot = getReviewedReaderTerminalSource();
    const serialized = JSON.stringify(snapshot);

    expect(serialized).not.toContain("site_publish_log");
    expect(serialized).not.toContain("article_queue");
    expect(serialized).not.toContain("/api/");
    expect(serialized).not.toContain("process.env");
    expect(serialized).not.toContain("fetch(");
    expect(snapshot.data.sourceLedger.map((source) => source.confidence)).toEqual(
      snapshot.data.sourceLedger.map(() => "fixture_only"),
    );
  });
});
