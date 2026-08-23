import { describe, expect, it } from "vitest";

import {
  formatSessionTimestamp,
  findSessionRecord,
  getAllSessionRecords,
  getSessionRecord,
  getTodaySchedule,
  normalizeFocusInstruments,
  type SessionRecord,
  parseSessionMeta,
} from "@/lib/sessions/session-content";

describe("formatSessionTimestamp", () => {
  // 生 ISO (2026-08-08T23:44:59+09:00) をそのまま読者に見せない。
  // schema (JST_ISO) が +09:00 を強制するので、表示は常に JST。
  it("renders a JST label without the ISO offset or seconds", () => {
    expect(formatSessionTimestamp("2026-08-08T23:44:59+09:00")).toBe(
      "2026-08-08 23:44 JST",
    );
  });

  it("accepts the seconds-less form the schema also allows", () => {
    expect(formatSessionTimestamp("2026-08-07T05:03+09:00")).toBe(
      "2026-08-07 05:03 JST",
    );
  });

  it("returns null for a missing timestamp", () => {
    expect(formatSessionTimestamp(null)).toBeNull();
  });

  it("passes through anything that is not the expected JST shape", () => {
    // 想定外の形を勝手に整形して誤表示するより、原文を出して気づけるようにする
    expect(formatSessionTimestamp("2026-08-08T23:44:59Z")).toBe(
      "2026-08-08T23:44:59Z",
    );
  });
});

describe("session content lifecycle (G-a)", () => {
  it("returns null only for a genuinely missing session", () => {
    expect(findSessionRecord("2099-01-01-asia-open")).toBeNull();
  });

  it("loads the live fixture session with lifecycle fields", () => {
    const record = getSessionRecord("2026-07-10-asia-open");
    expect(record.sessionId).toBe("2026-07-10-asia-open");
    expect(record.sessionSlug).toBe("asia-open");
    expect(record.liveStatus).toBe("live");
    expect(record.articleStatus).toBe("pending");
    expect(record.currentUrl).toBe("/sessions/2026-07-10-asia-open");
    expect(record.canonicalArticleUrl).toBeNull();
    expect(record.publishedAt).toBeNull();
    expect(record.publishLogId).toBeNull();
    expect(record.packetId).toBe("sess_20260710_asia");
    expect(record.focusInstruments).toEqual([
      "nikkei_futures",
      "usd_jpy",
      "btc_usd",
    ]);
    expect(record.focusFallbackApplied).toBe(false);
    expect(record.bullets.length).toBeGreaterThanOrEqual(2);
    // fix round 2 / I-2: a repo read always materializes a route (this record
    // lives in content/sessions/, so generateStaticParams produces its page).
    expect(record.hasMaterializedRoute).toBe(true);
  });

  it("normalizes invalid focus declarations to registry defaults", () => {
    expect(normalizeFocusInstruments(["nikkei_futures"], "asia-open")).toEqual(
      {
        instruments: ["nikkei_futures", "usd_jpy"],
        fallbackApplied: true,
      },
    );
    expect(
      normalizeFocusInstruments(
        ["nikkei_futures", "usd_jpy", "not_a_real_id"],
        "asia-open",
      ),
    ).toEqual({
      instruments: ["nikkei_futures", "usd_jpy"],
      fallbackApplied: false,
    });
    expect(
      normalizeFocusInstruments(
        ["nikkei_futures", "nikkei_futures"],
        "asia-open",
      ),
    ).toEqual({
      instruments: ["nikkei_futures", "usd_jpy"],
      fallbackApplied: true,
    });
  });

  it("rejects illegal lifecycle combinations", () => {
    expect(() =>
      parseSessionMeta({
        sessionId: "2026-07-09-ny-open",
        sessionSlug: "ny-open",
        date: "2026-07-09",
        liveStatus: "live",
        articleStatus: "published",
        currentUrl: "/sessions/2026-07-09-ny-open",
        canonicalArticleUrl: "/sessions/2026-07-09-ny-open",
        publishedAt: "2026-07-09T18:40:00+09:00",
        publishLogId: null,
        packetId: "sess_20260709_ny",
        asOfJst: "2026-07-09T18:40:00+09:00",
        focusInstruments: ["spx", "us10y"],
        titleJa: "x",
        bullets: ["a"],
      }),
    ).toThrow(/published session must have liveStatus=closed/);
  });

  it("crystallizes past sessions at the same URL", () => {
    const record = getSessionRecord("2026-08-07-global-close");
    expect(record.liveStatus).toBe("closed");
    expect(record.articleStatus).toBe("published");
    expect(record.canonicalArticleUrl).toBe(record.currentUrl);
    // publishedAt = crystallize 実行時刻 (セッション当日ではない)
    expect(record.publishedAt).toMatch(/^2026-08-08T/);
    expect(record.bodyJa).toContain("数値スナップショット");
  });

  it("rejects a published session whose canonical URL differs", () => {
    expect(() =>
      parseSessionMeta({
        sessionId: "2026-07-09-ny-open",
        sessionSlug: "ny-open",
        date: "2026-07-09",
        liveStatus: "closed",
        articleStatus: "published",
        currentUrl: "/sessions/2026-07-09-ny-open",
        canonicalArticleUrl: "/articles/wrong-place",
        publishedAt: "2026-07-09T18:40:00+09:00",
        publishLogId: null,
        packetId: "sess_20260709_ny",
        asOfJst: "2026-07-09T18:40:00+09:00",
        focusInstruments: ["spx", "us10y"],
        titleJa: "x",
        bullets: ["a", "b"],
      }),
    ).toThrow(/canonicalArticleUrl must equal currentUrl/);
  });

  it("orders the archive newest-first and excludes non-published sessions", () => {
    // 2026-08-14: crystallize auto-PR が毎日 content/sessions/ を増やすため、
    // 実コンテンツとの完全一致は書かない (最初の auto-PR #68 を guards が
    // 構造的にブロックした実証)。不変条件のみ検証する。
    const published = getAllSessionRecords().filter(
      (record) => record.articleStatus === "published",
    );
    // (a) newest-first (asOfJst 降順)
    for (let i = 1; i < published.length; i += 1) {
      expect(
        published[i - 1].asOfJst.localeCompare(published[i].asOfJst),
      ).toBeGreaterThanOrEqual(0);
    }
    // (b) 非公開 (pending の 2026-07-10 fixture) は含まれない
    expect(
      published.some((record) => record.articleStatus !== "published"),
    ).toBe(false);
    expect(
      published.some((record) => record.sessionId === "2026-07-10-asia-open"),
    ).toBe(false);
    // (c) 初回 crystallize (2026-08-07) の 3 本は必ず含まれる (subset)
    const ids = new Set(published.map((record) => record.sessionId));
    for (const expected of [
      "2026-08-07-global-close",
      "2026-08-07-ny-open",
      "2026-08-07-asia-open",
    ]) {
      expect(ids.has(expected), expected).toBe(true);
    }
  });
});

// 2026-08-23 田平氏 GO (spec §C): 「前回を読む →」はスロットごとの最新 closed
// レコード。feed 由来の当日 closed (articleStatus=pending・crystallize 前) も
// 対象にする — 切替中の間に「いま終わったセッション」へ飛べるようにする。
describe("getTodaySchedule previous (2026-08-23 closed-record rule)", () => {
  const base = (overrides: Partial<SessionRecord>): SessionRecord => ({
    sessionId: "2026-08-22-asia-open",
    date: "2026-08-22",
    sessionSlug: "asia-open",
    liveStatus: "closed",
    articleStatus: "published",
    currentUrl: "/sessions/2026-08-22-asia-open",
    canonicalArticleUrl: "/sessions/2026-08-22-asia-open",
    publishedAt: "2026-08-23T02:30:00+09:00",
    publishLogId: null,
    packetId: "sess_20260822_asia",
    asOfJst: "2026-08-22T07:30:00+09:00",
    focusInstruments: ["nikkei_futures", "usd_jpy"],
    titleJa: "Asia Open Terminal",
    bullets: ["前日"],
    focusFallbackApplied: false,
    bodyJa: "# body",
    hasMaterializedRoute: true,
    ...overrides,
  });
  const yesterdayPublished = base({});
  const todayClosedFeed = base({
    sessionId: "2026-08-23-asia-open",
    date: "2026-08-23",
    articleStatus: "pending",
    currentUrl: "/sessions/2026-08-23-asia-open",
    canonicalArticleUrl: null,
    publishedAt: null,
    asOfJst: "2026-08-23T07:30:00+09:00",
    bullets: ["当日"],
    bodyJa: null,
    hasMaterializedRoute: false,
  });
  const todayLiveFeed = base({
    sessionId: "2026-08-23-europe-bridge",
    date: "2026-08-23",
    sessionSlug: "europe-bridge",
    liveStatus: "live",
    articleStatus: "pending",
    currentUrl: "/sessions/2026-08-23-europe-bridge",
    canonicalArticleUrl: null,
    publishedAt: null,
    asOfJst: "2026-08-23T12:03:00+09:00",
    bodyJa: null,
    hasMaterializedRoute: false,
  });
  // getAllSessionRecords / mergeSessionRecords の不変条件 = asOfJst 降順
  const records = [todayLiveFeed, todayClosedFeed, yesterdayPublished];

  it("prefers today's closed feed record over the last crystallized article", () => {
    const schedule = getTodaySchedule("2026-08-23", null, records);
    const asia = schedule.find((item) => item.def.slug === "asia-open")!;
    expect(asia.previous?.sessionId).toBe("2026-08-23-asia-open");
    expect(asia.previous?.currentUrl).toBe("/sessions/2026-08-23-asia-open");
  });

  it("never points 'previous' at a live record", () => {
    const schedule = getTodaySchedule("2026-08-23", todayLiveFeed, records);
    const europe = schedule.find((item) => item.def.slug === "europe-bridge")!;
    expect(europe.isCurrent).toBe(true);
    expect(europe.previous).toBeUndefined();
  });

  it("falls back to the crystallized article when no newer closed record exists", () => {
    const schedule = getTodaySchedule("2026-08-23", null, [yesterdayPublished]);
    const asia = schedule.find((item) => item.def.slug === "asia-open")!;
    expect(asia.previous?.sessionId).toBe("2026-08-22-asia-open");
  });
});
