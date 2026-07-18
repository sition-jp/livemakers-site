import { describe, expect, it } from "vitest";
import { getBriefBySlug } from "@/lib/briefs";
import {
  isAllowedChromeRoute,
  isAllowedPublishedArticleRoute,
  readerTerminalPublicTopology,
  validateReaderTerminalPublicTopology,
} from "@/lib/livemakers-terminal-preview/public-topology";

function briefSlugFromHref(href: string): string | null {
  const match = href.match(/^\/brief\/([A-Za-z0-9-]+)$/);
  return match?.[1] ?? null;
}

describe("reader terminal public topology fixture", () => {
  it("keeps Live Radar title-only and separate from article links", () => {
    expect(readerTerminalPublicTopology.liveRadar.items.length).toBeGreaterThan(0);

    for (const item of readerTerminalPublicTopology.liveRadar.items) {
      expect(item.href).toBeNull();
      expect(item.title.en.length).toBeGreaterThan(0);
      expect(item.title.ja.length).toBeGreaterThan(0);
      expect(item.body).toBeUndefined();
    }
  });

  it("keeps the published article news feed clickable and route-safe", () => {
    const errors = validateReaderTerminalPublicTopology(readerTerminalPublicTopology);
    expect(errors).toEqual([]);

    expect(
      readerTerminalPublicTopology.articleNewsFeed.items.map((item) => item.href),
    ).toEqual([
      "/brief/2026-W26-brief",
      "/brief/2026-W25-brief",
      "/brief/2026-W24-brief",
      "/brief/2026-W23-brief",
    ]);
  });

  it("resolves every /brief link to an existing readable article", () => {
    for (const item of readerTerminalPublicTopology.articleNewsFeed.items) {
      const slug = briefSlugFromHref(item.href);
      if (slug === null) {
        continue;
      }

      expect(getBriefBySlug(slug)?.metadata.slug).toBe(slug);
    }
  });

  it("rejects hidden, internal, local, or operator-only article links", () => {
    const unsafe = {
      ...readerTerminalPublicTopology,
      articleNewsFeed: {
        ...readerTerminalPublicTopology.articleNewsFeed,
        items: [
          ...readerTerminalPublicTopology.articleNewsFeed.items,
          {
            id: "feed.bad.hidden-preview",
            family: "Signal" as const,
            title: { en: "Hidden preview leak", ja: "hidden preview leak" },
            href: "/terminal-preview",
            publishedAt: "2026-07-01T00:00:00+09:00",
            excerpt: { en: "bad", ja: "bad" },
          },
          {
            id: "feed.bad.local-path",
            family: "Deep Dive" as const,
            title: { en: "Local path leak", ja: "local path leak" },
            href: "file:///Users/sition/Documents/SITION/07_DATA/content/article_queue.jsonl",
            publishedAt: "2026-07-01T00:00:00+09:00",
            excerpt: { en: "bad", ja: "bad" },
          },
        ],
      },
    };

    expect(validateReaderTerminalPublicTopology(unsafe)).toEqual([
      "articleNewsFeed.items[4].href is not an allowed published article route: /terminal-preview",
      "articleNewsFeed.items[5].href is not an allowed published article route: file:///Users/sition/Documents/SITION/07_DATA/content/article_queue.jsonl",
      "articleNewsFeed.items[5].href contains forbidden internal text: 07_DATA",
      "articleNewsFeed.items[5].href contains forbidden internal text: article_queue",
      "articleNewsFeed.items[5].href contains forbidden internal text: file://",
    ]);
  });

  it("rejects clickable or unsanitized source-window items", () => {
    const unsafe = {
      ...readerTerminalPublicTopology,
      source: {
        title: { en: "Source", ja: "一次ソース" },
        badge: "SESSION" as const,
        asOf: "2026-07-05T05:03:00+09:00",
        items: [
          {
            id: "source.bad",
            title: {
              en: "Market desks are watching bit.ly/abc and @macro_guru",
              ja: "Market desks are watching bit.ly/abc and @macro_guru",
            },
            sourceDomain: "reuters.com/markets",
            category: { en: "Macro", ja: "マクロ" },
            freshnessLabel: { en: "as of 04:55 JST", ja: "04:55 JST 時点" },
            href: "/brief/2026-W27-brief",
          },
        ],
      },
    };

    expect(validateReaderTerminalPublicTopology(unsafe)).toEqual([
      "source.items[0].href is outside the non-click source whitelist",
      "source.items[0].title.en contains URL/handle pattern: bit.ly/abc",
      "source.items[0].title.en contains URL/handle pattern: @macro_guru",
      "source.items[0].title.ja contains URL/handle pattern: bit.ly/abc",
      "source.items[0].title.ja contains URL/handle pattern: @macro_guru",
      "source.items[0].sourceDomain must be a bare host",
    ]);
  });

  it("accepts the G41 article/session route families", () => {
    const allowed = [
      "/articles/daily-intel-2026-07-10",
      "/articles/today",
      "/articles/series/mkt12-morning",
      "/sessions/2026-07-10-asia-open",
      "/sessions/archive",
      "/future-atlas",
      "/future-atlas/ledger",
      "/future-atlas/methodology",
    ];
    for (const href of allowed) {
      expect(isAllowedPublishedArticleRoute(href), href).toBe(true);
    }
  });

  it("rejects locale-prefixed, traversal, and unknown routes", () => {
    const rejected = [
      "/ja/articles/daily-intel-2026-07-10",
      "/articles/../secret",
      "/articles/series/unknown-series",
      "/sessions/2026-07-10-midnight-run",
      "/terminal-preview",
      "/future-atlas/unknown",
      "/ja/future-atlas",
    ];
    for (const href of rejected) {
      expect(isAllowedPublishedArticleRoute(href), href).toBe(false);
    }
  });

  it("keeps the chrome ledger separate and exact-match only", () => {
    expect(isAllowedChromeRoute("/")).toBe(true);
    expect(isAllowedChromeRoute("/brief")).toBe(true);
    expect(isAllowedChromeRoute("/brief/2026-W26-brief")).toBe(false);
    expect(isAllowedChromeRoute("/terminal-preview")).toBe(false);
    expect(isAllowedChromeRoute("/future-atlas")).toBe(true);
    expect(isAllowedChromeRoute("/future-atlas/ledger")).toBe(true);
    expect(isAllowedChromeRoute("/future-atlas/methodology")).toBe(true);
  });
});
