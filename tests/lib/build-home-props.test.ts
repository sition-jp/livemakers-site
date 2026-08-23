import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildHomeCompositionProps,
  resolveHomeRadarSource,
  resolveHomeSessionsSource,
} from "@/lib/home/build-home-props";
import { loadMarketSnapshot } from "@/lib/home/market-snapshot";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";
import { loadFocusSeriesRecords } from "@/lib/sessions/focus-series";
import {
  getSessionRecord,
  type SessionRecord,
} from "@/lib/sessions/session-content";
import { mapTerminalFeed } from "@/lib/terminal/live-market-feed";

const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);

function v03Fixture() {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "tests/fixtures/terminal/terminal_feed_v0.3.home.sample.json",
      ),
      "utf8",
    ),
  );
}

function radarFeedFixture() {
  const data = mapTerminalFeed(v03Fixture());
  if (!data?.home || !data.radar) {
    throw new Error("valid v0.3 radar fixture did not map");
  }
  return { home: data.home, radar: data.radar };
}

function sessionsFeedFixture() {
  const data = mapTerminalFeed(v03Fixture());
  if (!data?.home || !data.sessions) {
    throw new Error("valid v0.3 sessions fixture did not map");
  }
  return { home: data.home, sessions: data.sessions };
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
    // radarSource is resolved outside the builder (fix round 1, mirrors
    // catalogSource) — resolveHomeRadarSource is the single source of truth.
    expect(resolveHomeRadarSource({})).toBe("empty");
    expect(props.slots.observing).toEqual([]);
  });

  it("stays honest-empty when a feed radar bundle is supplied but no market source is adopted", () => {
    const { radar } = radarFeedFixture();
    const props = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-07-10",
      contentDir: TEST_CONTENT_DIR,
      feedRadar: radar,
    });
    expect(resolveHomeRadarSource({ feedRadar: radar })).toBe("empty");
    expect(props.slots.observing).toEqual([]);
  });

  it("adopts the feed radar bundle only once the reviewed market source is adopted", () => {
    const { home, radar } = radarFeedFixture();
    const now = new Date("2026-07-12T08:00:00+09:00");
    const sessionRecords = [getSessionRecord("2026-07-10-asia-open")];
    const props = buildHomeCompositionProps({
      source: home,
      feedRadar: radar,
      now,
      sessionRecords,
      contentDir: TEST_CONTENT_DIR,
    });
    expect(
      resolveHomeRadarSource({ source: home, feedRadar: radar, now, sessionRecords }),
    ).toBe("feed");
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
    // 24h+ past home.asOfJst (2026-07-12T07:30) → reviewedSource not adopted.
    const now = new Date("2026-07-20T08:00:00+09:00");
    const sessionRecords = [getSessionRecord("2026-07-10-asia-open")];
    const props = buildHomeCompositionProps({
      source: home,
      feedRadar: radar,
      now,
      sessionRecords,
      contentDir: TEST_CONTENT_DIR,
    });
    expect(
      resolveHomeRadarSource({ source: home, feedRadar: radar, now, sessionRecords }),
    ).toBe("empty");
    expect(props.slots.observing).toEqual([]);
  });

  it("prioritizes explicit test injection over both the feed bundle and the empty default", () => {
    const { home, radar } = radarFeedFixture();
    const injectedPromotions = {
      [RADAR_OBSERVATIONS[0].topicId]: "signal-injected-promotion",
    };
    const now = new Date("2026-07-12T08:00:00+09:00");
    const sessionRecords = [getSessionRecord("2026-07-10-asia-open")];
    const props = buildHomeCompositionProps({
      source: home,
      feedRadar: radar,
      now,
      sessionRecords,
      contentDir: TEST_CONTENT_DIR,
      radar: RADAR_OBSERVATIONS,
      promotions: injectedPromotions,
    });
    expect(
      resolveHomeRadarSource({
        source: home,
        feedRadar: radar,
        now,
        sessionRecords,
        radar: RADAR_OBSERVATIONS,
        promotions: injectedPromotions,
      }),
    ).toBe("injected");
    expect(props.slots.observing.length).toBe(RADAR_OBSERVATIONS.length);
  });
});

describe("build-home-props sessions feed adoption (G43-e S2)", () => {
  it("stays repo-only when no feed sessions bundle is supplied", () => {
    expect(resolveHomeSessionsSource({})).toBe("repo");
  });

  it("stays repo-only when a feed sessions bundle is supplied but the reviewed market source is not adopted", () => {
    const { sessions } = sessionsFeedFixture();
    expect(resolveHomeSessionsSource({ feedSessions: sessions })).toBe("repo");
    const props = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-07-10",
      contentDir: TEST_CONTENT_DIR,
      sessionRecords: [],
      feedSessions: sessions,
    });
    // no source adopted -> feed session record never enters raw.sessions
    expect(props.live).toBeNull();
  });

  it("adopts the feed sessions bundle once the reviewed market source is adopted, and lifts the record to SessionRecord", () => {
    const { home, sessions } = sessionsFeedFixture();
    const now = new Date("2026-07-12T08:00:00+09:00");
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(
      resolveHomeSessionsSource({
        source: home,
        feedSessions: sessions,
        now,
        sessionRecords: [],
      }),
    ).toBe("feed_today");
    expect(props.live).not.toBeNull();
    expect(props.live!.sessionId).toBe(sessions.records[0].sessionId);
    expect(props.live!.articleStatus).toBe("pending");
    expect(props.live!.bodyJa).toBeNull();
    expect(props.live!.focusFallbackApplied).toBe(false);
    expect(props.live!.focusInstruments).toEqual(["btc_usd", "usd_jpy"]);
    expect(props.mkt12Provenance.sourceMode).toBe("reviewed_live");
    // fix round 2 / I-2, ①: no repo record shares this sessionId (sessionRecords
    // is []), so the lifted record was never crystallized to content/sessions/
    // — generateStaticParams would not produce a route for it.
    expect(props.live!.hasMaterializedRoute).toBe(false);
  });

  it("dedups by sessionId — the feed record wins over a same-id repo record", () => {
    const { home, sessions } = sessionsFeedFixture();
    const now = new Date("2026-07-12T08:00:00+09:00");
    const staleRepoRecord: SessionRecord = {
      sessionId: sessions.records[0].sessionId,
      date: sessions.records[0].date,
      sessionSlug: sessions.records[0].sessionSlug,
      liveStatus: "live",
      articleStatus: "pending",
      currentUrl: sessions.records[0].currentUrl,
      canonicalArticleUrl: null,
      publishedAt: null,
      publishLogId: null,
      packetId: "sess_20260712_asia_repo_stale",
      asOfJst: "2026-07-12T05:03:00+09:00",
      focusInstruments: ["btc_usd", "usd_jpy"],
      titleJa: "REPO STALE TITLE",
      bullets: ["repo stale bullet 1", "repo stale bullet 2"],
      focusFallbackApplied: false,
      bodyJa: null,
    };
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [staleRepoRecord],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.live!.titleJa).toBe(sessions.records[0].titleJa);
    expect(props.live!.packetId).toBe(sessions.records[0].packetId);
    expect(props.live!.titleJa).not.toBe("REPO STALE TITLE");
    // fix round 2 / I-2: the feed record wins the dedup, but a repo record
    // with the same sessionId DOES exist (staleRepoRecord) — the session was
    // already crystallized on disk, so the lifted (feed-content) record is
    // still materialized.
    expect(props.live!.hasMaterializedRoute).toBe(true);
  });

  it("falls back to repo-only when the market source is stale even though the sessions bundle is valid", () => {
    const { home, sessions } = sessionsFeedFixture();
    const staleNow = new Date("2026-07-20T08:00:00+09:00"); // 24h+ past home.asOfJst
    expect(
      resolveHomeSessionsSource({
        source: home,
        feedSessions: sessions,
        now: staleNow,
        sessionRecords: [],
      }),
    ).toBe("repo");
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now: staleNow,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.live).toBeNull();
    expect(props.mkt12Provenance.sourceMode).toBe("fixture_only");
  });
});

describe("build-home-props combined-bundle identity consistency (fix round 1 / G43-d+e)", () => {
  it("does not adopt the radar bundle when the sessions bundle's live record conflicts with focusSession, even though the plain (unmerged) repo sessionRecords are empty and would otherwise look consistent", () => {
    const { home, radar, sessions } = (() => {
      const data = mapTerminalFeed(v03Fixture());
      if (!data?.home || !data.radar || !data.sessions) {
        throw new Error("valid v0.3 fixture did not map");
      }
      return { home: data.home, radar: data.radar, sessions: data.sessions };
    })();
    // home.focusSession.sessionSlug is "asia-open" (see fixture); this feed
    // session record claims a *different* slug for the exact same date and
    // liveStatus=live — a same-date-live record that disagrees with what the
    // reviewed home packet computed as the live focus session. Pre-fix,
    // resolveHomeRadarSource only ever saw the plain (unmerged, here empty)
    // sessionRecords, so it never noticed this conflict and adopted "feed"
    // anyway — a self-contradictory page (radar="feed" + sessions="repo").
    const mismatchedSessions = {
      records: [
        {
          ...sessions.records[0],
          sessionId: "2026-07-12-europe-bridge",
          sessionSlug: "europe-bridge" as const,
          currentUrl: "/sessions/2026-07-12-europe-bridge",
        },
      ],
    };
    const now = new Date("2026-07-12T08:00:00+09:00");

    const sessionsSource = resolveHomeSessionsSource({
      source: home,
      feedSessions: mismatchedSessions,
      now,
      sessionRecords: [],
    });
    expect(sessionsSource).toBe("repo");

    const radarSource = resolveHomeRadarSource({
      source: home,
      feedRadar: radar,
      feedSessions: mismatchedSessions,
      now,
      sessionRecords: [],
    });
    // The self-contradictory pairing this closes off: radarSource must never
    // say "feed" while sessionsSource says "repo" for the same combined
    // bundle.
    expect(radarSource).toBe("empty");

    const props = buildHomeCompositionProps({
      source: home,
      feedRadar: radar,
      feedSessions: mismatchedSessions,
      now,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
    });
    // The builder's own internal radar/promotions selection must agree —
    // not just the exported resolver.
    expect(props.slots.observing).toEqual([]);
    expect(props.live).toBeNull();
  });
});

// 2026-08-23 田平氏 GO (spec §A): live が無い間は「直前に終わったセッション」を
// 終了として見せる。builder は recentClosed (+ provenance) を返す。
describe("build-home-props recentClosed (2026-08-23 switching-gap fill)", () => {
  function closedFeedFixture() {
    const { home, sessions } = sessionsFeedFixture();
    const closed = {
      ...sessions,
      records: sessions.records.map((record) => ({
        ...record,
        liveStatus: "closed" as const,
      })),
    };
    return { home, sessions: closed };
  }

  it("returns today's newest closed record when no session is live (Europe Bridge RED case)", () => {
    const { home, sessions } = closedFeedFixture();
    const now = new Date("2026-07-12T13:40:00+09:00");
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.live).toBeNull();
    expect(props.recentClosed?.sessionId).toBe("2026-07-12-asia-open");
    expect(props.recentClosed?.liveStatus).toBe("closed");
    // feed_today adoption carries the reviewed packet's provenance pair
    expect(props.recentClosedProvenance?.sourceMode).toBe(home.provenance.sourceMode);
    expect(props.recentClosedProvenance?.reviewStatus).toBe(
      home.provenance.reviewStatus,
    );
    expect(props.recentClosedProvenance?.asOfJst).toBe("07:30 JST");
  });

  it("still returns the closed record alongside a live one (render side prefers live)", () => {
    const { home, sessions } = sessionsFeedFixture();
    const now = new Date("2026-07-12T08:00:00+09:00");
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.live?.sessionId).toBe("2026-07-12-asia-open");
    // the only record is live → nothing closed to show
    expect(props.recentClosed).toBeNull();
    expect(props.recentClosedProvenance).toBeNull();
  });

  it("ignores stale fixture sessions (P0-1b degrade keeps the honest fallback)", () => {
    // article clock 2026-07-20: repo has the 07-10 fixture (stale) and the
    // crystallized 08-07+ sessions (future) — neither is today/yesterday.
    const props = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-07-20",
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.live).toBeNull();
    expect(props.recentClosed).toBeNull();
    expect(props.recentClosedProvenance).toBeNull();
  });

  it("shows a same-day crystallized session as recently closed even under repo-only degrade", () => {
    // articleCutoffToday 2026-08-07 = the first crystallize day (3 repo
    // records). Honest: the newest closed one (global-close 23:03) is shown
    // as ended — it really is from the article day.
    const props = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-08-07",
      contentDir: TEST_CONTENT_DIR,
    });
    expect(props.live).toBeNull();
    expect(props.recentClosed?.sessionId).toBe("2026-08-07-global-close");
    expect(props.recentClosedProvenance?.sourceMode).toBe("fixture_only");
    expect(props.recentClosedProvenance?.asOfJst).toBe("23:03 JST");
  });

  it("accepts the previous day's record (global-close carried past midnight)", () => {
    const { home, sessions } = closedFeedFixture();
    // feed date 2026-07-12 / article clock 2026-07-13 (00:45–05:02 窓)
    const now = new Date("2026-07-13T01:00:00+09:00");
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
      articleCutoffToday: "2026-07-13",
    });
    expect(props.recentClosed?.sessionId).toBe("2026-07-12-asia-open");
  });
});
