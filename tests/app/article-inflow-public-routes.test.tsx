/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  loadDetail: vi.fn(),
  notFound: vi.fn((): never => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: ({ source, options }: { source: string; options?: { mdxOptions?: { format?: string } } }) => (
    <div data-testid="rendered-markdown" data-source-format={options?.mdxOptions?.format}>{source}</div>
  ),
}));
vi.mock("remark-gfm", () => ({ default: vi.fn() }));
vi.mock("@/lib/articles/article-model", () => ({
  SERIES_SLUGS: ["daily-intel", "signal", "future-map", "weekly-brief"],
  getAllArticles: vi.fn(() => []),
}));
vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: mocks.loadCatalog,
  loadPublicArticleInflowDetail: mocks.loadDetail,
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => ({
    manifest: { entries: [] },
    contracts: [],
    states: new Map(),
    config: { surfacePublished: false },
  })),
}));
vi.mock("@/lib/home/market-snapshot", () => ({
  loadMarketSnapshot: vi.fn(() => ({ dataDate: "2026-07-19" })),
}));
vi.mock("@/components/home/ArticleRow", () => ({
  FAMILY_COLORS: { "daily-intel": "#fff", signal: "#fff" },
  ArticleRow: ({ article }: { article: { articleId: string; titleJa: string; href: string } }) => (
    <a href={article.href} data-testid={`article-row-${article.articleId}`}>{article.titleJa}</a>
  ),
}));
vi.mock("@/components/future-atlas/ArticleContractBlock", () => ({
  ArticleContractBlock: () => null,
}));
vi.mock("@/components/future-atlas/AuthorshipLine", () => ({ AuthorshipLine: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));

import ArticleDetailPage from "@/app/[locale]/articles/[slug]/page";
import ArticleSeriesPage from "@/app/[locale]/articles/series/[series]/page";
import TodayArticlesPage from "@/app/[locale]/articles/today/page";

const checksum = "5df91fa04b4c09f201d60beb7c13c051f01e1c82d15bb55075742aba4875f7d8";
const articles = [
  {
    articleId: "repo-owned",
    family: "signal",
    titleJa: "Repository article",
    titleEn: "Repository article EN",
    publishedAtJst: "2026-07-19T08:00:00+09:00",
    publishedLabel: "07-19 08:00 公開",
    lanes: [],
    href: "/articles/repo-owned",
    source: "repository",
  },
  {
    articleId: "daily-intel-20260719-48cea1b8",
    family: "daily-intel",
    titleJa: "Feed article",
    publishedAtJst: "2026-07-19T07:20:14+09:00",
    publishedLabel: "07-19 07:20 公開",
    lanes: [],
    href: "/articles/daily-intel-20260719-48cea1b8",
    source: "inflow",
    declaredBodyChecksum: checksum,
    inflowBody: "# Exact body\n",
  },
];

beforeEach(() => {
  mocks.loadCatalog.mockResolvedValue({ articles, feedChecksum: "8f36d3924040c7aa" });
  mocks.loadDetail.mockResolvedValue({
    article: articles[1],
    body: "# Exact body\n",
    declaredBodyChecksum: checksum,
    renderedBodyChecksum: checksum,
  });
  mocks.notFound.mockClear();
});

describe("public article inflow routes", () => {
  it("renders a dynamic inflow detail with exact checksum evidence and Markdown-only MDX", async () => {
    render(await ArticleDetailPage({
      params: Promise.resolve({ locale: "ja", slug: "daily-intel-20260719-48cea1b8" }),
    }));

    const body = screen.getByTestId("article-inflow-public-body");
    expect(body).toHaveAttribute("data-article-source", "inflow");
    expect(body).toHaveAttribute("data-declared-body-checksum", checksum);
    expect(body).toHaveAttribute("data-rendered-body-checksum", checksum);
    expect(screen.getByTestId("rendered-markdown")).toHaveTextContent("# Exact body");
    expect(screen.getByTestId("rendered-markdown")).toHaveAttribute("data-source-format", "md");
    expect(mocks.loadDetail).toHaveBeenCalledWith("daily-intel-20260719-48cea1b8", "ja");
  });

  it("passes normalized English locale to the shared detail boundary", async () => {
    await ArticleDetailPage({
      params: Promise.resolve({ locale: "en", slug: "daily-intel-20260719-48cea1b8" }),
    });
    expect(mocks.loadDetail).toHaveBeenCalledWith("daily-intel-20260719-48cea1b8", "en");
  });

  it("returns not found when neither repository nor Production feed owns the slug", async () => {
    mocks.loadDetail.mockResolvedValue(null);
    await expect(ArticleDetailPage({
      params: Promise.resolve({ locale: "ja", slug: "missing" }),
    })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows repository and inflow rows together on Today", async () => {
    render(await TodayArticlesPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getByText("Repository article")).toHaveAttribute("href", "/articles/repo-owned");
    expect(screen.getByText("Feed article")).toHaveAttribute(
      "href",
      "/articles/daily-intel-20260719-48cea1b8",
    );
  });

  it("filters the same public catalog for series pages", async () => {
    render(await ArticleSeriesPage({
      params: Promise.resolve({ locale: "ja", series: "daily-intel" }),
    }));
    expect(screen.getByText("Feed article")).toBeInTheDocument();
    expect(screen.queryByText("Repository article")).toBeNull();
  });
});
