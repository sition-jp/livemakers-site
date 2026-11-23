import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  topic: vi.fn(),
}));

vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: vi.fn(async () => ({
    articles: [],
    feedChecksum: null,
    feedPresent: true,
  })),
}));

vi.mock("@/lib/articles/article-inflow-v2", () => ({
  fetchArticleTopicIndex: mocks.topic,
}));

const FUNDING = "https://livemakers.com/ja/topics/funding";

async function urls() {
  const { default: sitemap } = await import("@/app/sitemap");
  return (await sitemap()).map((entry) => entry.url);
}

describe("app/sitemap.ts topics", () => {
  beforeEach(() => {
    mocks.topic.mockReset();
  });

  it("sitemap: lists /ja/topics/funding only when index has items", async () => {
    mocks.topic.mockResolvedValue({
      topic: "funding",
      generatedAt: "x",
      articles: [{ articleId: "a" }],
    });
    expect(await urls()).toContain(FUNDING);

    mocks.topic.mockResolvedValue({ topic: "funding", generatedAt: "x", articles: [] });
    expect(await urls()).not.toContain(FUNDING);

    mocks.topic.mockResolvedValue(null);
    expect(await urls()).not.toContain(FUNDING);
  });

  it("sitemap: survives a throwing topic index", async () => {
    mocks.topic.mockImplementation(async () => {
      throw new Error("boom");
    });
    expect(await urls()).not.toContain(FUNDING);
  });
});

// 2026-11-23 (田平氏 GO・案 1): 発行側が search_index: false を付けた Signal は載せない
describe("app/sitemap.ts search_index", () => {
  it("leaves out articles marked searchIndex: false and keeps the rest", async () => {
    mocks.topic.mockResolvedValue(null);
    const feed = await import("@/lib/articles/article-inflow-feed");
    const base = { publishedAtJst: "2026-11-23T10:00:00+09:00", publishedLabel: "x", lanes: [] };
    vi.mocked(feed.loadPublicArticleInflowCatalog).mockResolvedValueOnce({
      articles: [
        { ...base, articleId: "signal-a", family: "signal", titleJa: "a", href: "/articles/signal-a" },
        { ...base, articleId: "signal-b", family: "signal", titleJa: "b", href: "/articles/signal-b", searchIndex: false },
      ],
      feedChecksum: null,
      feedPresent: true,
    } as never);
    const list = await urls();
    expect(list).toContain("https://livemakers.com/ja/articles/signal-a");
    expect(list).not.toContain("https://livemakers.com/ja/articles/signal-b");
  });
});
