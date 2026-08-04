/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key),
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

import TodayArticlesPage from "@/app/[locale]/articles/today/page";

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
  vi.setSystemTime(new Date("2026-08-03T10:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Today articles real JST clock", () => {
  it("shows only articles from the current JST calendar date", async () => {
    mocks.loadCatalog.mockResolvedValue({
      articles: [
        article("signal-20260803-current", "2026-08-03T09:00:00+09:00"),
        article("signal-20260719-old", "2026-07-19T09:00:00+09:00"),
      ],
      feedChecksum: null,
      feedPresent: false,
    });

    render(
      await TodayArticlesPage({
        params: Promise.resolve({ locale: "ja" }),
      }),
    );

    expect(screen.getByText("signal-20260803-current")).toBeInTheDocument();
    expect(screen.queryByText("signal-20260719-old")).toBeNull();
    expect(screen.queryByText("todayEmpty")).toBeNull();
  });

  it("keeps the latest-five fallback when the current JST date has no articles", async () => {
    const older = Array.from({ length: 7 }, (_, index) =>
      article(
        `signal-old-${index}`,
        `2026-08-0${2 - Math.floor(index / 4)}T${String(20 - index).padStart(2, "0")}:00:00+09:00`,
      ),
    );
    mocks.loadCatalog.mockResolvedValue({
      articles: older,
      feedChecksum: null,
      feedPresent: false,
    });

    render(
      await TodayArticlesPage({
        params: Promise.resolve({ locale: "ja" }),
      }),
    );

    expect(screen.getByText("todayEmpty")).toBeInTheDocument();
    for (const item of older.slice(0, 5)) {
      expect(screen.getByText(item.titleJa)).toBeInTheDocument();
    }
    expect(screen.queryByText(older[5].titleJa)).toBeNull();
  });
});
