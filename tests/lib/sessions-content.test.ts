import { describe, expect, it } from "vitest";

import {
  formatSessionTimestamp,
  getAllSessionRecords,
  getSessionRecord,
  normalizeFocusInstruments,
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
    const published = getAllSessionRecords().filter(
      (record) => record.articleStatus === "published",
    );
    expect(published.map((record) => record.sessionId)).toEqual([
      "2026-08-07-global-close",
      "2026-08-07-ny-open",
      "2026-08-07-asia-open",
    ]);
  });
});
