import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { loadMarketSnapshot } from "@/lib/home/market-snapshot";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";
import { loadFocusSeriesRecords } from "@/lib/sessions/focus-series";
import { getSessionRecord } from "@/lib/sessions/session-content";
import { mapTerminalFeed } from "@/lib/terminal/live-market-feed";

const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);

function radarFeedFixture() {
  const feed = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "tests/fixtures/terminal/terminal_feed_v0.3.home.sample.json",
      ),
      "utf8",
    ),
  );
  const data = mapTerminalFeed(feed);
  if (!data?.home || !data.radar) {
    throw new Error("valid v0.3 radar fixture did not map");
  }
  return { home: data.home, radar: data.radar };
}

describe("build-home-props as-of integration (P1-2)", () => {
  const props = buildHomeCompositionProps({
    today: "2026-07-10",
    articleCutoffToday: "2026-07-10",
    contentDir: path.join(process.cwd(), "tests", "fixtures", "content", "articles"),
  });
  const snapshot = loadMarketSnapshot();

  it("uses snapshot as-of for market provenance and a real visible tuple globally", () => {
    expect(props.asOfLabel).toBe(snapshot.asOfLabel);
    expect(props.mkt12Provenance.asOfJst).toBe(snapshot.asOfLabel);
    expect(props.pageProvenance).toEqual(props.sessionProvenance);
  });

  it("includes the newest fixture record through the snapshot window end", () => {
    for (const series of props.focusSeries.filter(
      (candidate) => candidate !== null,
    )) {
      const newestInWindow = loadFocusSeriesRecords()
        .filter(
          (record) =>
            record.instrumentId === series!.instrumentId &&
            record.atJst <= snapshot.asOfJst,
        )
        .sort((left, right) => left.atJst.localeCompare(right.atJst))
        .at(-1)!;
      expect(series!.points.at(-1)!.atJst).toBe(newestInWindow.atJst);
      expect(series!.points.at(-1)!.atJst <= snapshot.asOfJst).toBe(true);
    }
    expect(
      props.focusSeries.some(
        (series) =>
          series?.points.at(-1)?.atJst ===
          "2026-07-10T07:30:00+09:00",
      ),
    ).toBe(true);
  });

  it("fails closed when snapshot date and today disagree", () => {
    expect(() => buildHomeCompositionProps({ today: "2026-07-11" })).toThrow(
      /does not match today/,
    );
  });

  it("passes an injected contentDir through to article selection", () => {
    const empty = buildHomeCompositionProps({
      today: "2026-07-10",
      contentDir: path.join(process.cwd(), "tests", "fixtures", "missing-content"),
    });
    expect(empty.slots.lead.state).toBe("pending");
  });

  it("treats explicit null as the reviewed-source fallback path", () => {
    const fallback = buildHomeCompositionProps({ source: null });
    expect(fallback.snapshot).toEqual(snapshot);
    expect(fallback.mkt12Provenance.sourceMode).toBe("fixture_only");
  });
});

describe("build-home-props radar honest-empty / feed adoption (G43-d)", () => {
  it("defaults to honest empty when neither injected nor a valid feed source is adopted", () => {
    const props = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-07-10",
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.radarSource).toBe("empty");
    expect(props.slots.observing).toEqual([]);
    expect(props.slots.radarPair).toBeNull();
  });

  it("stays honest-empty when a feed radar bundle is supplied but no market source is adopted", () => {
    const { radar } = radarFeedFixture();
    const props = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-07-10",
      contentDir: TEST_CONTENT_DIR,
      feedRadar: radar,
    });
    expect(props.radarSource).toBe("empty");
    expect(props.slots.observing).toEqual([]);
  });

  it("adopts the feed radar bundle only once the reviewed market source is adopted", () => {
    const { home, radar } = radarFeedFixture();
    const props = buildHomeCompositionProps({
      source: home,
      feedRadar: radar,
      now: new Date("2026-07-12T08:00:00+09:00"),
      sessionRecords: [getSessionRecord("2026-07-10-asia-open")],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.radarSource).toBe("feed");
    expect(props.slots.observing.map((observation) => observation.topicId)).toEqual([
      "stablecoin_supply_20260712",
      "tokenized_mmf_report_20260712",
    ]);
    // The feed-only observedAtJst field must not leak into the site-facing
    // RadarObservation shape (RadarObservationSchema is a strict object).
    expect(Object.keys(props.slots.observing[0]).sort()).toEqual([
      "displayMode",
      "href",
      "lane",
      "observedAtLabel",
      "publishDecision",
      "titleJa",
      "topicId",
    ]);
  });

  it("falls back to honest empty when the market source is stale (reviewed source not adopted)", () => {
    const { home, radar } = radarFeedFixture();
    const props = buildHomeCompositionProps({
      source: home,
      feedRadar: radar,
      // 24h+ past home.asOfJst (2026-07-12T07:30) → reviewedSource not adopted.
      now: new Date("2026-07-20T08:00:00+09:00"),
      sessionRecords: [getSessionRecord("2026-07-10-asia-open")],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.radarSource).toBe("empty");
    expect(props.slots.observing).toEqual([]);
  });

  it("prioritizes explicit test injection over both the feed bundle and the empty default", () => {
    const { home, radar } = radarFeedFixture();
    const injectedPromotions = {
      [RADAR_OBSERVATIONS[0].topicId]: "signal-injected-promotion",
    };
    const props = buildHomeCompositionProps({
      source: home,
      feedRadar: radar,
      now: new Date("2026-07-12T08:00:00+09:00"),
      sessionRecords: [getSessionRecord("2026-07-10-asia-open")],
      contentDir: TEST_CONTENT_DIR,
      radar: RADAR_OBSERVATIONS,
      promotions: injectedPromotions,
    });
    expect(props.radarSource).toBe("injected");
    expect(props.slots.observing.length + (props.slots.radarPair ? 1 : 0)).toBe(
      RADAR_OBSERVATIONS.length,
    );
  });
});
