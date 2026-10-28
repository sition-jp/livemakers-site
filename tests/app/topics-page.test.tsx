/* @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  index: null as { topic: string; generatedAt: string; articles: unknown[] } | null,
  catalog: vi.fn(),
  redirect: vi.fn((): never => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: mocks.redirect,
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: mocks.catalog,
}));

vi.mock("@/lib/articles/article-inflow-v2", () => ({
  fetchArticleTopicIndex: vi.fn(async () => mocks.index),
  fetchArticleRail: vi.fn(async () => ({ latest: [], byFamily: {}, generatedAt: "x" })),
}));

vi.mock("@/lib/articles/latest-articles-rail", () => ({
  loadLatestArticlesRail: vi.fn(async () => ({
    articles: [],
    copy: { title: "rail" },
  })),
}));

import ArticleTopicPage from "@/app/[locale]/topics/[topic]/page";
import ArticleTopicPagedPage from "@/app/[locale]/topics/[topic]/page/[page]/page";

// 新しい順: 1 日 10 本ずつ 10/02 → 以降
function article(index: number) {
  const day = 2 - Math.floor(index / 10);
  const ymd = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
  const hour = String(20 - (index % 10)).padStart(2, "0");
  const id = `fund-${String(index).padStart(3, "0")}`;
  return {
    articleId: id,
    family: "signal",
    titleJa: `資金調達 ${index}`,
    publishedAtJst: `${ymd}T${hour}:00:00+09:00`,
    publishedLabel: `${ymd.slice(5)} ${hour}:00 公開`,
    lanes: [],
    href: `/articles/${id}`,
  };
}

function setIndex(count: number) {
  mocks.index = {
    topic: "funding",
    generatedAt: "2026-10-28T00:00:00+09:00",
    articles: Array.from({ length: count }, (_, i) => article(i)),
  };
}

beforeEach(() => {
  mocks.index = null;
  mocks.catalog.mockClear();
  mocks.redirect.mockClear();
});

const rowIds = () =>
  [...within(screen.getByRole("main")).getAllByRole("link")]
    .map((link) => link.getAttribute("data-article-id"))
    .filter(Boolean);

const params = (topic = "funding") => ({
  params: Promise.resolve({ locale: "ja", topic }),
});

describe("topic page", () => {
  it("topic page: renders title, description, rule and rows newest first", async () => {
    setIndex(3);
    render(await ArticleTopicPage(params()));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("funding.title");
    expect(screen.getByText("funding.description")).toBeTruthy();
    expect(screen.getByText("funding.rule")).toBeTruthy();
    expect(rowIds()).toEqual(["fund-000", "fund-001", "fund-002"]);
    const note = screen.getByText("weeklyBriefNote").closest("a");
    expect(note?.getAttribute("href")).toBe("/articles/series/weekly-brief");
  });

  it("topic page: unavailable index renders guide only", async () => {
    mocks.index = null;
    render(await ArticleTopicPage(params()));
    expect(rowIds()).toEqual([]);
    expect(screen.getByText("funding.description")).toBeTruthy();
    expect(screen.getByText("funding.rule")).toBeTruthy();
    expect(screen.getByText("weeklyBriefNote")).toBeTruthy();
  });

  it("topic page: unknown topic is 404", async () => {
    await expect(ArticleTopicPage(params("nope"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("topic page: page beyond range is 404", async () => {
    setIndex(31);
    await expect(
      ArticleTopicPagedPage({
        params: Promise.resolve({ locale: "ja", topic: "funding", page: "3" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("topic page: page 2+ of an empty shelf is 404", async () => {
    mocks.index = null;
    await expect(
      ArticleTopicPagedPage({
        params: Promise.resolve({ locale: "ja", topic: "funding", page: "2" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("topic page: 31 items paginate to page 2 with topic hrefs", async () => {
    setIndex(31);
    render(await ArticleTopicPage(params()));
    expect(rowIds()).toHaveLength(30);
    const nav = document.querySelector("[data-series-pagination]") as HTMLElement;
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/topics/funding/page/2");
    expect(hrefs.some((href) => href?.includes("/articles/series"))).toBe(false);
  });

  it("topic page: page 2 shows the remainder", async () => {
    setIndex(31);
    render(
      await ArticleTopicPagedPage({
        params: Promise.resolve({ locale: "ja", topic: "funding", page: "2" }),
      }),
    );
    expect(rowIds()).toEqual(["fund-030"]);
  });

  it("topic page: does not load the v1 catalog", async () => {
    setIndex(3);
    render(await ArticleTopicPage(params()));
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
});
