/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(
    async () => (key: string, values?: Record<string, unknown>) =>
      `${key}:${JSON.stringify(values ?? {})}`,
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: mocks.loadCatalog,
}));

vi.mock("@/components/home/ArticleRow", () => ({
  ArticleRow: ({
    article,
  }: {
    article: { articleId: string; titleJa: string; href: string };
  }) => (
    <a href={article.href} data-testid={`article-row-${article.articleId}`}>
      {article.titleJa}
    </a>
  ),
}));

import DayArticlesPage, { generateStaticParams, revalidate } from "@/app/[locale]/articles/day/[date]/page";

function article(articleId: string, publishedAtJst: string) {
  return {
    articleId,
    family: "signal",
    titleJa: articleId,
    publishedAtJst,
    publishedLabel: publishedAtJst.slice(0, 16),
    lanes: [],
    href: `/articles/${articleId}`,
    source: "repository",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T12:30:00+09:00"));
  mocks.loadCatalog.mockResolvedValue({
    articles: [
      article("a-1110", "2026-11-10T09:00:00+09:00"),
      article("a-1109-2", "2026-11-09T18:00:00+09:00"),
      article("a-1109-1", "2026-11-09T08:00:00+09:00"),
      article("a-1108", "2026-11-08T08:00:00+09:00"),
    ],
    feedChecksum: null,
    feedPresent: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const render_ = async (date: string) =>
  render(
    await DayArticlesPage({ params: Promise.resolve({ locale: "ja", date }) }),
  );

describe("Day articles page", () => {
  it("revalidates every 5 minutes so an early 404 does not linger", () => {
    expect(revalidate).toBe(300);
  });

  it("exports an empty generateStaticParams so the route is ISR, not dynamic", () => {
    expect(generateStaticParams()).toEqual([]);
  });

  it("renders only that day's articles with count attribute", async () => {
    const { container } = await render_("2026-11-09");
    expect(container.querySelectorAll('[data-testid^="article-row-"]')).toHaveLength(2);
    const main = container.querySelector("main") as HTMLElement;
    expect(main.dataset.articleCount).toBe("2");
    expect(main.dataset.day).toBe("2026-11-09");
    expect(container.querySelector("h1")?.textContent).toContain(
      'dayTitle:{"month":11,"day":9,"count":2}',
    );
  });

  it("links prev and next days", async () => {
    const { container } = await render_("2026-11-09");
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/articles/day/2026-11-08");
    expect(hrefs).toContain("/articles/day/2026-11-10");

    const today = await render_("2026-11-10");
    const todayHrefs = Array.from(today.container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(todayHrefs).toContain("/articles/day/2026-11-09");
    expect(todayHrefs).not.toContain("/articles/day/2026-11-11");
  });

  it.each(["2026-11-07", "2026-11-11", "2026-02-30"])(
    "404 for %s",
    async (date) => {
      await expect(render_(date)).rejects.toThrow("NEXT_NOT_FOUND");
    },
  );
});
