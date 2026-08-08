import { describe, expect, it } from "vitest";

import { resolveSessionPageRecord } from "@/lib/sessions/session-page-resolver";
import type {
  SessionRecord,
  SessionRecordMeta,
} from "@/lib/sessions/session-content";

const pendingFeed: SessionRecordMeta = {
  sessionId: "2026-08-09-asia-open",
  date: "2026-08-09",
  sessionSlug: "asia-open",
  liveStatus: "live",
  articleStatus: "pending",
  currentUrl: "/sessions/2026-08-09-asia-open",
  canonicalArticleUrl: null,
  publishedAt: null,
  publishLogId: null,
  packetId: "sess_20260809_asia",
  asOfJst: "2026-08-09T07:30:00+09:00",
  focusInstruments: ["btc_usd", "usd_jpy"],
  titleJa: "Asia Open Terminal",
  bullets: ["BTC $63,299", "USD/JPY 162.343"],
  editorial: {
    digestId: "dig_20260809_0712_ab12cd34",
    crawlAnchorJst: "2026-08-09T05:03:00+09:00",
    writtenAtJst: "2026-08-09T07:12:00+09:00",
    lead: "市場は方向感を探っている。一次情報では判断材料が示された。",
    items: [
      {
        headline: "一次情報で確認された主要な動き",
        sourceUrl: "https://primary.example.org/news/123",
      },
    ],
    watch: ["次の公式発表を確認する。"],
  },
};

const publishedRepo: SessionRecord = {
  ...pendingFeed,
  liveStatus: "closed",
  articleStatus: "published",
  canonicalArticleUrl: pendingFeed.currentUrl,
  publishedAt: "2026-08-09T12:03:00+09:00",
  focusInstruments: ["btc_usd", "usd_jpy"],
  focusFallbackApplied: false,
  bodyJa: "# Git に永続化された本文",
  hasMaterializedRoute: true,
};

describe("resolveSessionPageRecord", () => {
  it("resolves a pre-crystallize pending session from the current accepted feed at the same URL", () => {
    const record = resolveSessionPageRecord({
      slug: pendingFeed.sessionId,
      repoRecords: [],
      feedSessions: { records: [pendingFeed] },
    });
    expect(record?.currentUrl).toBe(pendingFeed.currentUrl);
    expect(record?.editorial).toEqual(pendingFeed.editorial);
    expect(record?.hasMaterializedRoute).toBe(false);
  });

  it("keeps a crystallized published repo record authoritative at that same URL", () => {
    expect(
      resolveSessionPageRecord({
        slug: pendingFeed.sessionId,
        repoRecords: [publishedRepo],
        feedSessions: { records: [pendingFeed] },
      }),
    ).toBe(publishedRepo);
  });

  it("returns null when neither an accepted feed record nor repo record exists", () => {
    expect(
      resolveSessionPageRecord({
        slug: pendingFeed.sessionId,
        repoRecords: [],
        feedSessions: null,
      }),
    ).toBeNull();
  });
});
