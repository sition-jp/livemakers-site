import { describe, expect, it, vi } from "vitest";

const mockCatalog = vi.hoisted(() => ({
  loadPublicArticleInflowCatalog: vi.fn(async () => ({
    articles: [
      {
        articleId: "daily-intel-recent",
        family: "daily-intel",
        titleJa: "Recent",
        publishedAtJst: new Date().toISOString().replace("Z", "+09:00"),
        publishedLabel: "recent",
        lanes: [],
        href: "/articles/daily-intel-recent",
        source: "inflow",
      },
    ],
    feedChecksum: null,
    feedPresent: true,
  })),
}));

vi.mock("@/lib/articles/article-inflow-feed", () => mockCatalog);

describe("app/sitemap-news.xml/route.ts", () => {
  it("returns application/xml with a 6-hour s-maxage (refreshed on publish) and a news:news block", async () => {
    const { GET } = await import("@/app/sitemap-news.xml/route");
    const response = await GET();
    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8",
    );
    // 2026-10-26 段 1: 鮮度は記事の公開の合図で保ち、時間は 6 時間の保険
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=21600");
    const body = await response.text();
    expect(body).toContain("<news:news>");
    expect(body).toContain("daily-intel-recent");
  });
});
