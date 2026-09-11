import { describe, expect, it, vi } from "vitest";

const mockCatalog = vi.hoisted(() => ({
  loadPublicArticleInflowCatalog: vi.fn(async () => ({
    articles: [
      {
        articleId: "daily-intel-20260911-abc123",
        family: "daily-intel",
        titleJa: "Daily Intel 9/11",
        excerptJa: "今日のまとめ。",
        publishedAtJst: "2026-09-11T05:50:00+09:00",
        publishedLabel: "09-11 05:50 公開",
        lanes: [],
        href: "/articles/daily-intel-20260911-abc123",
        source: "inflow",
        thumbnailUrl: "https://example.com/thumb.webp",
      },
    ],
    feedChecksum: null,
    feedPresent: true,
  })),
}));

vi.mock("@/lib/articles/article-inflow-feed", () => mockCatalog);

describe("/ja/feed.xml and /ja/feed", () => {
  it("both return an identical RSS 2.0 payload (the /feed → /ja/feed redirect rescue)", async () => {
    const { GET: getFeedXml } = await import("@/app/ja/feed.xml/route");
    const { GET: getFeed } = await import("@/app/ja/feed/route");

    const xmlResponse = await getFeedXml();
    const feedResponse = await getFeed();

    expect(xmlResponse.headers.get("Content-Type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
    const [xmlBody, feedBody] = await Promise.all([
      xmlResponse.text(),
      feedResponse.text(),
    ]);
    expect(xmlBody).toBe(feedBody);
    expect(xmlBody).toContain("<title>Daily Intel 9/11</title>");
    expect(xmlBody).toContain("今日のまとめ。");
    expect(xmlBody).toContain(
      '<atom:link href="https://livemakers.com/ja/feed.xml" rel="self" type="application/rss+xml" />',
    );
  });
});
