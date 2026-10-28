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
