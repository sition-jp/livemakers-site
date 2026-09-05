import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { normalizeHomeInput, selectHomeSlots } from "@/lib/home/select-home-slots";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";
import { getSessionRecord } from "@/lib/sessions/session-content";
import {
  mapTerminalFeed,
  type ReviewedHomeData,
} from "@/lib/terminal/live-market-feed";

const NOW = new Date("2026-08-03T10:00:00+09:00");
const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);
const MISSING_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "missing-content",
);

function article(
  articleId: string,
  publishedAtJst: string,
  family: ArticleMeta["family"] = "signal",
  extra: Partial<ArticleMeta> = {},
): ArticleMeta {
  return {
    articleId,
    family,
    titleJa: articleId,
    excerptJa: `${articleId} excerpt`,
    publishedAtJst,
    publishedLabel: publishedAtJst.slice(0, 10),
    lanes: [],
    href: `/articles/${articleId}`,
    ...extra,
  };
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
  if (!source) throw new Error("valid reviewed fixture did not map");
  return source;
}

function slotInput(articles: ArticleMeta[]) {
  return {
    articles,
    sessions: [],
    radar: RADAR_OBSERVATIONS,
    promotions: {},
    today: "2026-07-10",
    articleCutoffToday: "2026-08-03",
  };
}

function signalBatch(
  prefix: string,
  timestamps: readonly string[],
): ArticleMeta[] {
  return timestamps.map((publishedAtJst, index) =>
    article(`${prefix}-${String(index).padStart(2, "0")}`, publishedAtJst),
  );
}

describe("home catalog overlay (P2-LVM-HOME-G1)", () => {
  it("uses injected articles instead of the repository read", () => {
    const injected = [
      article(
        "signal-20260801-aaaaaaaa",
        "2026-08-01T12:24:32+09:00",
      ),
    ];
    const props = buildHomeCompositionProps({
      source: null,
      now: NOW,
      contentDir: MISSING_CONTENT_DIR,
      sessionRecords: [],
      articles: injected,
    });

    expect(props.slots.latestArticles.map((item) => item.articleId)).toEqual([
      "signal-20260801-aaaaaaaa",
    ]);
  });

  it("fixture degrade: article cutoff follows real JST now", () => {
    const props = buildHomeCompositionProps({
      source: null,
      now: NOW,
      sessionRecords: [],
      articles: [
        article(
          "daily-intel-20260722-3a64d786",
          "2026-07-22T12:20:00+09:00",
          "daily-intel",
        ),
      ],
    });

    expect(props.slots.latestArticles.map((item) => item.articleId)).toContain(
      "daily-intel-20260722-3a64d786",
    );
  });

  it("fixture degrade preserves returned today, focusSeries, and top-level keys while demoting the fixture session (P0-1b)", () => {
    const props = buildHomeCompositionProps({ source: null, now: NOW });

    expect(props.today).toBe("2026-07-10");
    expect(props.snapshot.pagePacketId).toContain("_fx01");
    // P0-1b (G44 Amendment A): the 2026-07-10 fixture session must not
    // present as live once the real date has moved past it. The focus
    // fallback still renders fixture series with fixture provenance.
    expect(props.live).toBeNull();
    expect(props.focusSessionSlug).toBe("asia-open");
    expect(props.focusSeries.filter(Boolean).length).toBeGreaterThan(0);
    expect(Object.keys(props).sort()).toEqual([
      "asOfLabel",
      "coreCells",
      "focusSeries",
      "focusSessionSlug",
      "laneCells",
      "laneProvenance",
      "live",
      "mkt12Provenance",
      "pageProvenance",
      // 2026-08-23 田平氏 GO (spec 2026-08-23-terminal-switching-ux-design §A):
      // recentClosed / recentClosedProvenance を追加 (切替中の埋め草)。
      "recentClosed",
      "recentClosedProvenance",
      "schedule",
      "sessionProvenance",
      "slots",
      "snapshot",
      "tickerItems",
      "today",
    ]);
  });

  it("future-dated articles stay excluded under the real-now cutoff", () => {
    const props = buildHomeCompositionProps({
      source: null,
      now: NOW,
      sessionRecords: [],
      articles: [
        article("signal-20990101-ffffffff", "2099-01-01T00:00:00+09:00"),
      ],
    });

    expect(props.slots.latestArticles.map((item) => item.articleId)).not.toContain(
      "signal-20990101-ffffffff",
    );
  });

  it("reviewed adopted with a previous-day packet: article cutoff still follows real JST now", () => {
    // 2026-09-05: 当日の packet が届かず前日 packet が 24h 採用され続けても、
    // 当日公開の記事はホームに出る (market today と記事 today は別の時計)。
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: new Date("2026-07-13T07:30:00+09:00"),
      sessionRecords: [],
      articles: [
        article("signal-20260713-after-snapshot", "2026-07-13T01:00:00+09:00"),
        article("signal-20260714-future", "2026-07-14T00:00:00+09:00"),
      ],
    });

    expect(props.snapshot.dataDate).toBe("2026-07-12");
    expect(props.today).toBe("2026-07-12");
    expect(props.slots.latestArticles.map((item) => item.articleId)).toEqual([
      "signal-20260713-after-snapshot",
    ]);
  });

  it("omitting articles falls back to the repository read", () => {
    const props = buildHomeCompositionProps({
      source: null,
      now: NOW,
      contentDir: TEST_CONTENT_DIR,
      sessionRecords: [],
    });

    expect(props.slots.latestArticles.length).toBeGreaterThan(0);
  });
});

describe("session clock (sessionClockToday) stays separate from the article clock", () => {
  const liveGlobalClose = {
    ...getSessionRecord("2026-07-10-asia-open"),
    sessionId: "2026-07-12-global-close",
    sessionSlug: "global-close" as const,
    date: "2026-07-12",
    liveStatus: "live" as const,
  };

  it("keeps a previous-day live session live when the session clock is the packet date", () => {
    const normalized = normalizeHomeInput({
      articles: [],
      sessions: [liveGlobalClose],
      radar: [],
      promotions: {},
      today: "2026-07-12",
      articleCutoffToday: "2026-07-13",
      sessionClockToday: "2026-07-12",
    });

    expect(normalized.sessions[0]?.liveStatus).toBe("live");
  });

  it("demotes a previous-day live session when no session clock is supplied", () => {
    const normalized = normalizeHomeInput({
      articles: [],
      sessions: [liveGlobalClose],
      radar: [],
      promotions: {},
      today: "2026-07-12",
      articleCutoffToday: "2026-07-13",
    });

    expect(normalized.sessions[0]?.liveStatus).toBe("closed");
  });
});

describe("article clock (articleToday) consistency", () => {
  it("does not classify a signal 25h+ before the cutoff clock in the 24h bucket", () => {
    const within = signalBatch(
      "within",
      Array.from(
        { length: 10 },
        (_, index) =>
          `2026-08-03T${String(index).padStart(2, "0")}:30:00+09:00`,
      ),
    );
    const older = article("older-25h", "2026-08-01T12:00:00+09:00");

    const slots = selectHomeSlots(slotInput([older, ...within]));

    expect(slots.signalTimeline).toHaveLength(10);
    expect(slots.signalTimeline.map((item) => item.articleId)).not.toContain(
      "older-25h",
    );
  });

  it("classifies a signal within 24h of cutoff day-end in the 24h bucket", () => {
    const within = article("within-24h", "2026-08-03T09:00:00+09:00");
    const older = signalBatch(
      "older",
      Array.from(
        { length: 9 },
        (_, index) =>
          `2026-08-02T${String(9 - index).padStart(2, "0")}:00:00+09:00`,
      ),
    );

    const slots = selectHomeSlots(slotInput([within, ...older]));

    expect(slots.signalTimeline[0]?.articleId).toBe("within-24h");
    expect(slots.signalTimeline).toHaveLength(10);
  });

  it("keeps floor completion by promoting only the newest older signals", () => {
    const within = [
      article("within-a", "2026-08-03T09:00:00+09:00"),
      article("within-b", "2026-08-03T08:00:00+09:00"),
    ];
    const older = signalBatch(
      "floor",
      Array.from(
        { length: 9 },
        (_, index) =>
          `2026-08-02T${String(9 - index).padStart(2, "0")}:00:00+09:00`,
      ),
    );

    const slots = selectHomeSlots(slotInput([...older, ...within]));
    const ids = slots.signalTimeline.map((item) => item.articleId);

    expect(ids).toEqual([
      "within-a",
      "within-b",
      ...older.slice(0, 8).map((item) => item.articleId),
    ]);
    expect(ids).not.toContain("floor-08");
  });

  it("excludes articles after articleToday from every slot", () => {
    const current = article(
      "daily-intel-20260803-current",
      "2026-08-03T12:00:00+09:00",
      "daily-intel",
    );
    const future = article(
      "daily-intel-20260804-future",
      "2026-08-04T00:00:00+09:00",
      "daily-intel",
    );

    const slots = selectHomeSlots(slotInput([future, current]));

    expect(slots.lead.article?.articleId).toBe(current.articleId);
    expect(slots.latestArticles.map((item) => item.articleId)).not.toContain(
      future.articleId,
    );
  });

  it("selects todayIntel and todayMorning with articleToday, not market today", () => {
    const dailyIntel = article(
      "daily-intel-20260803-current",
      "2026-08-03T12:00:00+09:00",
      "daily-intel",
    );
    const morning = article(
      "mkt12-morning-20260803-current",
      "2026-08-03T07:30:00+09:00",
      "mkt12-morning",
      { dataDate: "2026-08-03" },
    );

    const slots = selectHomeSlots(slotInput([dailyIntel, morning]));

    expect(slots.lead).toMatchObject({
      state: "today",
      article: { articleId: dailyIntel.articleId },
    });
    expect(slots.mkt12).toMatchObject({
      state: "published",
      article: { articleId: morning.articleId },
    });
  });

  it("keeps session live demotion on the article clock (P0-1b)", () => {
    // P0-1b (G44 Amendment A) superseded the market-today demotion clock:
    // a session dated articleCutoffToday stays live even when the market
    // snapshot date lags, and a session behind the article clock demotes.
    const session = {
      ...getSessionRecord("2026-07-10-asia-open"),
      date: "2026-08-03",
    };

    const base = { ...slotInput([]), sessions: [session] };
    const onArticleToday = normalizeHomeInput({
      ...base,
      articleCutoffToday: "2026-08-03",
    });
    expect(onArticleToday.sessions[0]).toMatchObject({
      date: "2026-08-03",
      liveStatus: "live",
    });

    const behindArticleToday = normalizeHomeInput({
      ...base,
      articleCutoffToday: "2026-08-04",
    });
    expect(behindArticleToday.sessions[0]).toMatchObject({
      date: "2026-08-03",
      liveStatus: "closed",
    });
  });
});
