import { describe, expect, it, vi } from "vitest";

import { KNOWN_BOTS, ROBOTS_DISALLOW, ROBOTS_ONLY_TOKENS } from "@/lib/ai-bots";

type RobotsGroup = { userAgent: string | string[]; allow?: string; disallow: string[] };

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
      {
        articleId: "flash-20260911-def456",
        family: "flash",
        titleJa: "🚨速報｜テスト",
        publishedAtJst: "2026-09-11T06:10:00+09:00",
        publishedLabel: "09-11 06:10 公開",
        lanes: [],
        href: "/articles/flash-20260911-def456",
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
    const rules = (result.rules as RobotsGroup[])[0];
    expect(rules.disallow).toEqual(
      expect.arrayContaining([
        "/api/",
        "/ja/article-inflow-preview",
        "/ja/terminal-preview",
      ]),
    );
  });

  it("keeps Googlebot off Next.js RSC payload URLs but not off the pages themselves", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = (robots().rules as RobotsGroup[])[0];
    expect(rules.disallow).toEqual(expect.arrayContaining(["/*?_rsc=", "/*&_rsc="]));
    expect(rules.allow).toBe("/");
    expect(rules.disallow).not.toContain("/ja/articles/");
  });

  it("puts the * group first with the full disallow list", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = robots().rules as RobotsGroup[];
    expect(rules[0]).toEqual({ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW });
  });

  it("names every robots:true bot and robots-only token, each group carrying the same disallow", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = robots().rules as RobotsGroup[];
    const named = rules.slice(1).flatMap((g) => g.userAgent);
    const expected = [
      ...KNOWN_BOTS.filter((b) => b.robots).map((b) => b.name),
      ...ROBOTS_ONLY_TOKENS,
    ];
    expect([...named].sort()).toEqual([...expected].sort());
    for (const group of rules) {
      expect(group.disallow).toEqual(ROBOTS_DISALLOW);
    }
  });

  it("does not name search engines or preview fetchers", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = robots().rules as RobotsGroup[];
    const named = rules.flatMap((g) => g.userAgent).map((n) => n.toLowerCase());
    for (const n of ["googlebot", "bingbot", "slackbot", "twitterbot", "facebookexternalhit"]) {
      expect(named).not.toContain(n);
    }
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
    expect(urls).toContain("https://livemakers.com/ja/videos");
    expect(urls).toContain("https://livemakers.com/ja/videos/ep001-finance-reboot");
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

  it("leaves flash articles and the flash series page out of the sitemap (2026-11-10)", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/articles/flash-"))).toBe(false);
    expect(urls).not.toContain("https://livemakers.com/ja/articles/series/flash");
    expect(urls).toContain("https://livemakers.com/ja/articles/series/signal");
  });
});
