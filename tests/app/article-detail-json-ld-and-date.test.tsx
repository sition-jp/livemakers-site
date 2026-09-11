/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * G3 (2026-09-11 田平氏 GO): 記事詳細ページの `NewsArticle` JSON-LD と、
 * 可視の公開日 (年あり + `dateTime` 属性) を検証する。mock 境界は
 * `tests/app/article-inflow-public-routes.test.tsx` と同一 — RSC 依存の
 * 芋づるを避けるための既存パターンを踏襲する。
 */
const mocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  loadDetail: vi.fn(),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: () => null,
}));
vi.mock("remark-gfm", () => ({ default: vi.fn() }));
vi.mock("@/lib/articles/article-model", () => ({
  SERIES_SLUGS: ["daily-intel", "signal"],
  ARTICLE_FAMILIES: ["daily-intel", "signal"],
  getAllArticles: vi.fn(() => []),
}));
vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: mocks.loadCatalog,
  loadPublicArticleInflowDetail: mocks.loadDetail,
}));
vi.mock("@/lib/future-atlas/surface", () => ({
  loadEffectiveSurfacePublished: vi.fn(
    async (data: { config: { surfacePublished: boolean } }) =>
      data.config.surfacePublished,
  ),
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => ({
    manifest: { entries: [] },
    contracts: [],
    states: new Map(),
    config: { surfacePublished: false },
  })),
}));
vi.mock("@/components/home/ArticleRow", () => ({
  FAMILY_COLORS: { "daily-intel": "#fff", signal: "#fff" },
  ArticleRow: () => null,
}));
vi.mock("@/components/future-atlas/ArticleContractBlock", () => ({
  ArticleContractBlock: () => null,
}));
vi.mock("@/components/future-atlas/AuthorshipLine", () => ({ AuthorshipLine: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));

import ArticleDetailPage from "@/app/[locale]/articles/[slug]/page";

const article = {
  articleId: "signal-20260807-089db35f",
  family: "signal",
  titleJa: "📡 Signal｜Circle Arc の創設バリデータに BlackRock・Visa・DTCC",
  publishedAtJst: "2026-08-07T18:18:00+09:00",
  publishedLabel: "08-07 18:18 公開",
  lanes: [],
  href: "/articles/signal-20260807-089db35f",
  source: "inflow",
  thumbnailUrl: "https://example.com/thumb.webp",
};

beforeEach(() => {
  mocks.loadCatalog.mockResolvedValue({ articles: [article], feedChecksum: null });
  mocks.loadDetail.mockResolvedValue({
    article,
    body: "# body\n",
    declaredBodyChecksum: "x",
    renderedBodyChecksum: "x",
  });
  mocks.notFound.mockClear();
});

describe("article detail: NewsArticle JSON-LD + full-year published date", () => {
  it("embeds a NewsArticle JSON-LD script with the article's own fields", async () => {
    const { container } = render(
      await ArticleDetailPage({
        params: Promise.resolve({ locale: "ja", slug: article.articleId }),
      }),
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const json = JSON.parse(script!.textContent!);
    expect(json["@type"]).toBe("NewsArticle");
    expect(json.headline).toBe(article.titleJa);
    expect(json.datePublished).toBe(article.publishedAtJst);
    expect(json.dateModified).toBe(article.publishedAtJst);
    expect(json.image).toEqual([article.thumbnailUrl]);
    expect(json.isAccessibleForFree).toBe(true);
  });

  it("shows the full year in the visible date and carries a machine dateTime", async () => {
    render(
      await ArticleDetailPage({
        params: Promise.resolve({ locale: "ja", slug: article.articleId }),
      }),
    );

    const time = screen.getByText("2026-08-07 18:18 公開");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", article.publishedAtJst);
  });
});
