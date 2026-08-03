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

  it("fixture degrade preserves returned today, live session, focusSeries, and top-level keys", () => {
    const props = buildHomeCompositionProps({ source: null, now: NOW });

    expect(props.today).toBe("2026-07-10");
    expect(props.snapshot.pagePacketId).toContain("_fx01");
    expect(props.live).toMatchObject({
      date: "2026-07-10",
      liveStatus: "live",
    });
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

  it("reviewed adopted: cutoff equals snapshot.dataDate", () => {
    const props = buildHomeCompositionProps({
      source: reviewedHomeSource(),
      now: new Date("2026-07-13T07:30:00+09:00"),
      sessionRecords: [],
      articles: [
        article("signal-20260713-after-snapshot", "2026-07-13T01:00:00+09:00"),
      ],
    });

    expect(props.snapshot.dataDate).toBe("2026-07-12");
    expect(props.slots.latestArticles).toEqual([]);
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

  it("keeps an explicit today as the legacy article clock when now is omitted", () => {
    const current = article(
      "daily-intel-20260710-current",
      "2026-07-10T12:00:00+09:00",
      "daily-intel",
    );
    const later = article(
      "daily-intel-20260711-later",
      "2026-07-11T12:00:00+09:00",
      "daily-intel",
    );

    const props = buildHomeCompositionProps({
      source: null,
      today: "2026-07-10",
      sessionRecords: [],
      articles: [later, current],
    });

    expect(props.slots.lead).toMatchObject({
      state: "today",
      article: { articleId: current.articleId },
    });
    expect(props.slots.latestArticles.map((item) => item.articleId)).toEqual([
      current.articleId,
    ]);
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

  it("keeps session live demotion on market today", () => {
    const session = {
      ...getSessionRecord("2026-07-10-asia-open"),
      date: "2026-08-03",
    };

    const normalized = normalizeHomeInput({
      ...slotInput([]),
      sessions: [session],
    });

    expect(normalized.sessions[0]).toMatchObject({
      date: "2026-08-03",
      liveStatus: "closed",
    });
  });
});
