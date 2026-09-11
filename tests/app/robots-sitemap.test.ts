import { describe, expect, it, vi } from "vitest";

const mockCatalog = vi.hoisted(() => ({
  loadPublicArticleInflowCatalog: vi.fn(async () => ({
    articles: [
      {
        articleId: "daily-intel-20260911-abc123",
        family: "daily-intel",
        titleJa: "Daily Intel 9/11",
        publishedAtJst: "2026-09-11T05:50:00+09:00",
        publishedLabel: "09-11 05:50 公開",
        lanes: [],
        href: "/articles/daily-intel-20260911-abc123",
        source: "inflow",
      },
    ],
    feedChecksum: null,
    feedPresent: true,
  })),
}));

vi.mock("@/lib/articles/article-inflow-feed", () => mockCatalog);

describe("app/robots.ts", () => {
  it("allows crawling and points at both sitemaps, disallowing hidden preview routes", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    expect(result.sitemap).toEqual([
      "https://livemakers.com/sitemap.xml",
      "https://livemakers.com/sitemap-news.xml",
    ]);
    const rules = result.rules as { disallow: string[] };
    expect(rules.disallow).toEqual(
      expect.arrayContaining([
        "/api/",
        "/ja/article-inflow-preview",
        "/ja/terminal-preview",
      ]),
    );
  });
});

describe("app/sitemap.ts", () => {
  it("includes static routes, series pages, the new legal pages, and ja-only article urls", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://livemakers.com/ja");
    expect(urls).toContain("https://livemakers.com/ja/about");
    expect(urls).toContain("https://livemakers.com/ja/editorial-policy");
    expect(urls).toContain("https://livemakers.com/ja/contact");
    expect(urls).toContain("https://livemakers.com/ja/privacy");
    expect(urls).toContain("https://livemakers.com/ja/articles/series/daily-intel");
    expect(urls).toContain(
      "https://livemakers.com/ja/articles/daily-intel-20260911-abc123",
    );
    // no /en article URLs (inflow feed carries no real English translation)
    expect(urls.some((url) => url.includes("/en/articles/"))).toBe(false);

    const article = entries.find((entry) =>
      entry.url.endsWith("/articles/daily-intel-20260911-abc123"),
    )!;
    expect(article.lastModified).toBe("2026-09-11T05:50:00+09:00");
  });
});
