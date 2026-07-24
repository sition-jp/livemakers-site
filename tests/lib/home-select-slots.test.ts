import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAllArticles, type ArticleMeta } from "@/lib/articles/article-model";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";
import {
  collectSelectedArticleIds,
  normalizeHomeInput,
  selectHomeSlots,
} from "@/lib/home/select-home-slots";
import { getAllSessionRecords } from "@/lib/sessions/session-content";

const isDescending = (articles: ArticleMeta[]): boolean =>
  articles.every(
    (article, index) =>
      index === 0 ||
      articles[index - 1].publishedAtJst.localeCompare(
        article.publishedAtJst,
      ) >= 0,
  );

const TEST_CONTENT_DIR = path.join(process.cwd(), "tests", "fixtures", "content", "articles");
const TEST_PROMOTIONS = {
  stablecoin_supply_20260710: "signal-stablecoin-supply-2026-07-10",
};

const input = () => ({
  articles: getAllArticles({ contentDir: TEST_CONTENT_DIR }),
  sessions: getAllSessionRecords(),
  radar: RADAR_OBSERVATIONS,
  promotions: TEST_PROMOTIONS,
  today: "2026-07-10",
});

describe("home slot selection (B+)", () => {
  it("selects today's Daily Intel as lead", () => {
    const slots = selectHomeSlots(input());
    expect(slots.lead.state).toBe("today");
    expect(slots.lead.article?.articleId).toBe("daily-intel-2026-07-10");
  });

  it("falls back lead from latest eligible to pending", () => {
    const noToday = {
      ...input(),
      articles: input().articles.filter(
        (article) => article.articleId !== "daily-intel-2026-07-10",
      ),
    };
    expect(selectHomeSlots(noToday).lead.state).toBe("latest");
    const noIntel = {
      ...input(),
      articles: input().articles.filter(
        (article) => article.family !== "daily-intel",
      ),
    };
    expect(selectHomeSlots(noIntel).lead.state).toBe("pending");
  });

  it("pairs today's mkt12 article, weekend, and two archive entries", () => {
    const slots = selectHomeSlots(input());
    expect(slots.mkt12.article?.articleId).toBe(
      "mkt12-morning-2026-07-10",
    );
    expect(slots.mkt12.weekend?.articleId).toBe("mkt12-weekend-2026-07-04");
    expect(slots.mkt12.archive.map((article) => article.articleId)).toEqual([
      "mkt12-morning-2026-07-09",
      "mkt12-morning-2026-07-08",
    ]);
    expect(slots.mkt12.state).toBe("published");
  });

  it("marks mkt12 awaiting when today's article is missing", () => {
    const slots = selectHomeSlots({
      ...input(),
      articles: input().articles.filter(
        (article) => article.articleId !== "mkt12-morning-2026-07-10",
      ),
    });
    expect(slots.mkt12.state).toBe("awaiting");
    expect(slots.mkt12.article).toBeNull();
    expect(slots.mkt12.previous?.articleId).toBe(
      "mkt12-morning-2026-07-09",
    );
  });

  it("pairs one promoted observation with its Signal", () => {
    const slots = selectHomeSlots(input());
    expect(slots.radarPair?.observation.topicId).toBe(
      "stablecoin_supply_20260710",
    );
    expect(slots.radarPair?.article.articleId).toBe(
      "signal-stablecoin-supply-2026-07-10",
    );
    expect(slots.observing).toHaveLength(3);
  });

  it("keeps an observation visible when its promoted article is missing", () => {
    const slots = selectHomeSlots({
      ...input(),
      articles: input().articles.filter(
        (article) =>
          article.articleId !== "signal-stablecoin-supply-2026-07-10",
      ),
    });
    expect(slots.radarPair).toBeNull();
    expect(slots.observing).toHaveLength(4);
    expect(
      slots.observing.some(
        (observation) =>
          observation.topicId === "stablecoin_supply_20260710",
      ),
    ).toBe(true);
  });

  it("keeps radar pair null and observations intact when promotions are empty", () => {
    const slots = selectHomeSlots({
      ...input(),
      promotions: {},
    });
    expect(slots.radarPair).toBeNull();
    expect(slots.observing.length).toBeGreaterThan(0);
    expect(slots.observing).toHaveLength(RADAR_OBSERVATIONS.length);
  });

  it("uses the latest resolvable promotion", () => {
    const slots = selectHomeSlots({
      ...input(),
      promotions: {
        ...TEST_PROMOTIONS,
        eu_stablecoin_guidance_20260710: "no-such-article",
      },
    });
    expect(slots.radarPair?.observation.topicId).toBe(
      "stablecoin_supply_20260710",
    );
    expect(
      slots.observing.some(
        (observation) =>
          observation.topicId === "eu_stablecoin_guidance_20260710",
      ),
    ).toBe(true);
  });

  it("excludes future-dated articles from every slot", () => {
    const future = {
      ...input().articles[0],
      articleId: "daily-intel-2026-07-11",
      publishedAtJst: "2026-07-11T05:40:00+09:00",
      href: "/articles/daily-intel-2026-07-11",
    };
    const slots = selectHomeSlots({
      ...input(),
      articles: [future, ...input().articles],
    });
    expect(slots.lead.article?.articleId).toBe("daily-intel-2026-07-10");
    expect(collectSelectedArticleIds(slots)).not.toContain(
      "daily-intel-2026-07-11",
    );
  });

  it("demotes a live session whose date is not today", () => {
    const stale = input().sessions.map((record) =>
      record.sessionId === "2026-07-10-asia-open"
        ? { ...record, date: "2026-07-09" }
        : record,
    );
    const normalized = normalizeHomeInput({ ...input(), sessions: stale });
    expect(
      normalized.sessions.every(
        (record) => record.liveStatus !== "live" || record.date === "2026-07-10",
      ),
    ).toBe(true);
  });

  it("supplies the signal timeline excluding the promoted pair", () => {
    const slots = selectHomeSlots(input());
    expect(slots.signalTimeline.length).toBeGreaterThanOrEqual(10);
    expect(
      slots.signalTimeline.every((article) => article.family === "signal"),
    ).toBe(true);
    expect(isDescending(slots.signalTimeline)).toBe(true);
    expect(
      slots.signalTimeline.map((article) => article.articleId),
    ).not.toContain("signal-stablecoin-supply-2026-07-10");
  });

  it("shelves five deep dives newest-first with the featured lead", () => {
    const slots = selectHomeSlots(input());
    expect(slots.deepDives).toHaveLength(5);
    expect(isDescending(slots.deepDives)).toBe(true);
    expect(slots.deepDives[0].articleId).toBe(
      "deep-dive-tokenized-treasuries",
    );
  });

  it("lists the ten latest articles across families", () => {
    const slots = selectHomeSlots(input());
    expect(slots.latestArticles).toHaveLength(10);
    expect(isDescending(slots.latestArticles)).toBe(true);
    expect(
      new Set(slots.latestArticles.map((article) => article.family)).size,
    ).toBeGreaterThan(1);
  });

  it("resolves the per-family latest slots for the index modules", () => {
    const slots = selectHomeSlots(input());
    expect(slots.eventRiskLatest?.articleId).toBe("event-risk-radar-w29");
    expect(slots.mkt12WeekendLatest?.articleId).toBe(
      "mkt12-weekend-2026-07-04",
    );
    expect(slots.atlasLatest?.articleId).toBe("future-map-financial-reset-3");
    expect(slots.weeklyBriefLatest?.articleId).toBe("weekly-brief-001");
  });

  it("prefers the newest observation when two promotions resolve", () => {
    const articles = input().articles.map((article) =>
      article.articleId === "signal-jgb-yield-move-2026-07-09"
        ? {
            ...article,
            radarTopicId: "eu_stablecoin_guidance_20260710",
          }
        : article,
    );
    const slots = selectHomeSlots({
      ...input(),
      articles,
      promotions: {
        ...TEST_PROMOTIONS,
        eu_stablecoin_guidance_20260710:
          "signal-jgb-yield-move-2026-07-09",
      },
    });
    expect(slots.radarPair?.observation.topicId).toBe(
      "eu_stablecoin_guidance_20260710",
    );
    expect(
      slots.observing.some(
        (observation) =>
          observation.topicId === "stablecoin_supply_20260710",
      ),
    ).toBe(true);
  });

  it("dedupes article ids across the whole page", () => {
    const ids = collectSelectedArticleIds(selectHomeSlots(input()));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
