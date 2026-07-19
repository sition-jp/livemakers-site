import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { loadMarketSnapshot } from "@/lib/home/market-snapshot";
import { getSessionRecord, type SessionRecord } from "@/lib/sessions/session-content";
import { mapTerminalFeed, type ReviewedHomeData } from "@/lib/terminal/live-market-feed";

const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);
const REVIEWED_AS_OF = "2026-07-12T07:30:00+09:00";

function nowAt(value: string): Date {
  return new Date(value);
}

function reviewedHomeSource(): ReviewedHomeData {
  const payload = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "tests",
        "fixtures",
        "terminal",
        "terminal_feed_v0.2.home.sample.json",
      ),
      "utf8",
    ),
  );
  const source = mapTerminalFeed(payload)?.home;
  if (!source) throw new Error("valid v0.2 test source did not map");
  return source;
}

function mismatchedSameDateLive(): SessionRecord {
  const fixture = getSessionRecord("2026-07-10-asia-open");
  return {
    ...fixture,
    sessionId: "2026-07-12-ny-open",
    date: "2026-07-12",
    sessionSlug: "ny-open",
    currentUrl: "/sessions/2026-07-12-ny-open",
    packetId: "sess_20260712_ny",
    asOfJst: "2026-07-12T05:03:00+09:00",
    focusInstruments: ["spx", "us10y"],
  };
}

describe("G43 reviewed home source resolution", () => {
  it("uses one coherent reviewed bundle for snapshot, series and provenance", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: nowAt(REVIEWED_AS_OF),
      contentDir: TEST_CONTENT_DIR,
      sessionRecords: [],
    });

    expect(props.today).toBe("2026-07-12");
    expect(props.snapshot.packetId).toBe("mkt12_20260712_am");
    expect(props.snapshot.cells).toHaveLength(21);
    expect(
      props.snapshot.cells.find((cell) => cell.instrumentId === "night_usd"),
    ).toMatchObject({ nameJa: "NIGHT/USD", direction: "down" });
    expect(
      props.snapshot.cells.find((cell) => cell.instrumentId === "ada_usd"),
    ).toMatchObject({ changeLabel: "0.00%", direction: "flat" });
    expect(props.mkt12Provenance.sourceMode).toBe("reviewed_live");
    expect(props.laneProvenance.macro.sourceMode).toBe("reviewed_live");
    expect(props.laneProvenance.crypto.sourceMode).toBe("reviewed_live");
    expect(props.laneProvenance.rwa.sourceMode).toBe("fixture_only");
    expect(props.focusSessionSlug).toBe("asia-open");
    expect(
      props.focusSeries.every(
        (series) => series === null || series.sourceMode === "reviewed_live",
      ),
    ).toBe(true);
    expect(props.pageProvenance).toEqual(props.laneProvenance.rwa);
  });

  it("falls back market and series together when reviewed home is absent", () => {
    const props = buildHomeCompositionProps({ source: null });
    expect(props.today).toBe("2026-07-10");
    expect(props.snapshot.pagePacketId).toContain("_fx01");
    expect(props.mkt12Provenance.sourceMode).toBe("fixture_only");
    expect(
      props.focusSeries.every(
        (series) => series === null || series.sourceMode === "fixture_only",
      ),
    ).toBe(true);
  });

  it("renders feed focus when the old fixture session is demoted by dataDate", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: nowAt(REVIEWED_AS_OF),
      sessionRecords: [getSessionRecord("2026-07-10-asia-open")],
    });
    expect(props.today).toBe("2026-07-12");
    expect(props.live).toBeNull();
    expect(props.focusSessionSlug).toBe("asia-open");
    expect(props.focusSeries.filter(Boolean)).toHaveLength(2);
  });

  it("falls back the whole bundle when a same-date live sidecar disagrees", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: nowAt(REVIEWED_AS_OF),
      sessionRecords: [mismatchedSameDateLive()],
    });
    expect(props.today).toBe("2026-07-10");
    expect(props.mkt12Provenance.sourceMode).toBe("fixture_only");
    expect(
      props.focusSeries.every(
        (series) => series === null || series.sourceMode === "fixture_only",
      ),
    ).toBe(true);
  });

  it("accepts a reviewed snapshot exactly 24 hours old", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: nowAt("2026-07-13T07:30:00+09:00"),
      contentDir: TEST_CONTENT_DIR,
      sessionRecords: [],
    });

    expect(props.snapshot.packetId).toBe("mkt12_20260712_am");
    expect(props.mkt12Provenance.sourceMode).toBe("reviewed_live");
  });

  it("rejects a reviewed snapshot older than 24 hours", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: nowAt("2026-07-13T07:30:01+09:00"),
    });

    expect(props.snapshot).toEqual(loadMarketSnapshot());
    expect(props.mkt12Provenance.sourceMode).toBe("fixture_only");
  });

  it("rejects a future-dated reviewed snapshot", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: nowAt("2026-07-12T07:29:59+09:00"),
    });

    expect(props.snapshot).toEqual(loadMarketSnapshot());
    expect(props.mkt12Provenance.sourceMode).toBe("fixture_only");
  });

  it("falls back without reviewed focus or provenance leakage and keeps fixture windows usable", () => {
    const source = reviewedHomeSource();
    const props = buildHomeCompositionProps({
      source,
      now: nowAt("2026-07-13T07:30:01+09:00"),
    });

    expect(props.coreCells).toHaveLength(12);
    expect(props.laneCells.macro.length).toBeGreaterThan(0);
    expect(props.laneCells.crypto.length).toBeGreaterThan(0);
    expect(props.laneCells.rwa.length).toBeGreaterThan(0);
    expect(props.mkt12Provenance).toMatchObject({
      sourceMode: "fixture_only",
      reviewStatus: "reviewed_fixture",
    });
    expect(props.laneProvenance.macro).toMatchObject({
      sourceMode: "fixture_only",
      reviewStatus: "reviewed_fixture",
    });
    expect(props.focusSeries.filter(Boolean).length).toBeGreaterThan(0);
    expect(
      props.focusSeries.every(
        (series) => series === null || series.sourceMode === "fixture_only",
      ),
    ).toBe(true);
    expect(
      props.focusSeries.some((series) =>
        source.focusSession.series.some(
          (reviewed) => reviewed.seriesPacketId === series?.seriesPacketId,
        ),
      ),
    ).toBe(false);
  });

  it("surfaces a reviewed snapshot with an explicit JST calendar date and time", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: nowAt(REVIEWED_AS_OF),
      contentDir: TEST_CONTENT_DIR,
      sessionRecords: [],
    });

    expect(props.snapshot.asOfLabel).toBe("2026-07-12 07:30 JST");
    expect(props.asOfLabel).toBe("2026-07-12 07:30 JST");
    expect(props.mkt12Provenance.asOfJst).toBe(
      "2026-07-12 07:30 JST",
    );
    expect(props.laneProvenance.macro.asOfJst).toBe(
      "2026-07-12 07:30 JST",
    );
  });
});
