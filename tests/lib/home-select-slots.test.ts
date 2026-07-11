import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAllArticles } from "@/lib/articles/article-model";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";
import { RADAR_PROMOTIONS } from "@/lib/home/radar-promotions";
import {
  collectSelectedArticleIds,
  normalizeHomeInput,
  selectHomeSlots,
} from "@/lib/home/select-home-slots";
import { getAllSessionRecords } from "@/lib/sessions/session-content";

const TEST_CONTENT_DIR = path.join(process.cwd(), "tests", "fixtures", "content", "articles");

const input = () => ({
  articles: getAllArticles({ contentDir: TEST_CONTENT_DIR }),
  sessions: getAllSessionRecords(),
  radar: RADAR_OBSERVATIONS,
  promotions: RADAR_PROMOTIONS,
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
        ...RADAR_PROMOTIONS,
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

  it("obeys lane inventory boundaries 2, 1, and 0", () => {
    const full = selectHomeSlots(input());
    expect(full.lanes.map((lane) => lane.lane)).toEqual([
      "macro",
      "crypto",
      "rwa",
    ]);
    for (const lane of full.lanes) {
      expect(lane.articles).toHaveLength(2);
    }

    const thin = input().articles.filter(
      (article) =>
        !article.lanes.includes("rwa") ||
        article.articleId === "deep-dive-tokenized-treasuries",
    );
    expect(
      selectHomeSlots({ ...input(), articles: thin })
        .lanes.find((lane) => lane.lane === "rwa")
        ?.articles.map((article) => article.articleId),
    ).toEqual(["deep-dive-tokenized-treasuries"]);

    const none = input().articles.filter(
      (article) => !article.lanes.includes("rwa"),
    );
    expect(
      selectHomeSlots({ ...input(), articles: none }).lanes.find(
        (lane) => lane.lane === "rwa",
      )?.articles,
    ).toEqual([]);
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
        ...RADAR_PROMOTIONS,
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

  it("prefers unseen families on the library shelf", () => {
    const slots = selectHomeSlots(input());
    const families = slots.library.map((article) => article.family);
    expect(families).toContain("weekly-brief");
    expect(families).toContain("future-map");
    expect(slots.library).toHaveLength(3);
  });
});
