/* @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  articles: [] as unknown[],
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
  loadPublicArticleInflowCatalog: vi.fn(async () => ({
    articles: mocks.articles,
    feedChecksum: null,
  })),
}));

vi.mock("@/lib/articles/latest-articles-rail", () => ({
  loadLatestArticlesRail: vi.fn(async () => ({
    articles: [],
    copy: { title: "rail" },
  })),
}));

vi.mock("@/lib/future-atlas/surface", () => ({
  loadEffectiveSurfacePublished: vi.fn(async () => false),
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => ({ config: { surfacePublished: false } })),
}));

import ArticleSeriesPage from "@/app/[locale]/articles/series/[series]/page";
import ArticleSeriesPagedPage from "@/app/[locale]/articles/series/[series]/page/[page]/page";

// 65 本の Signal (新しい順): 1 日 10 本ずつ 10/02 → 09/26 に並ぶ + Deep Dive 1 本
function signal(index: number) {
  const day = 2 - Math.floor(index / 10);
  const date = new Date(Date.UTC(2026, 9, day));
  const ymd = date.toISOString().slice(0, 10);
  const hour = String(20 - (index % 10)).padStart(2, "0");
  return {
    articleId: `signal-${String(index).padStart(3, "0")}`,
    family: "signal",
    titleJa: `Signal ${index}`,
    publishedAtJst: `${ymd}T${hour}:00:00+09:00`,
    publishedLabel: `${ymd.slice(5)} ${hour}:00 公開`,
    lanes: [],
    href: `/articles/signal-${String(index).padStart(3, "0")}`,
  };
}

beforeEach(() => {
  mocks.articles = [
    ...Array.from({ length: 65 }, (_, index) => signal(index)),
    {
      ...signal(0),
      articleId: "deep-dive-x",
      family: "deep-dive",
      href: "/articles/deep-dive-x",
    },
  ];
  mocks.redirect.mockClear();
});

const rowIds = () =>
  [...within(screen.getByRole("main")).getAllByRole("link")]
    .map((link) => link.getAttribute("data-article-id"))
    .filter(Boolean);

describe("series list pagination (30 per page)", () => {
  it("shows the newest 30 on page 1 with date headings and links to older pages", async () => {
    render(
      await ArticleSeriesPage({
        params: Promise.resolve({ locale: "ja", series: "signal" }),
      }),
    );
    const ids = rowIds();
    expect(ids).toHaveLength(30);
    expect(ids[0]).toBe("signal-000");
    expect(ids[29]).toBe("signal-029");

    const headings = within(screen.getByRole("main")).getAllByRole("heading", {
      level: 2,
    });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "10月2日(金)",
      "10月1日(木)",
      "9月30日(水)",
    ]);
    expect(screen.getByTestId("series-page-indicator").textContent).toBe(
      'pagination.pageOf:{"page":1,"total":3}',
    );

    const nav = screen.getByRole("navigation", { name: "pagination.label" });
    expect(within(nav).queryByText("pagination.newer")).toBeNull();
    expect(within(nav).getByText("pagination.older")).toHaveAttribute(
      "href",
      "/articles/series/signal/page/2",
    );
    expect(within(nav).getByText("1")).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByText("3")).toHaveAttribute(
      "href",
      "/articles/series/signal/page/3",
    );
  });

  it("serves the remaining articles on later pages and links back to the root URL", async () => {
    render(
      await ArticleSeriesPagedPage({
        params: Promise.resolve({ locale: "ja", series: "signal", page: "3" }),
      }),
    );
    expect(rowIds()).toEqual([
      "signal-060",
      "signal-061",
      "signal-062",
      "signal-063",
      "signal-064",
    ]);
    const nav = screen.getByRole("navigation", { name: "pagination.label" });
    expect(within(nav).queryByText("pagination.older")).toBeNull();
    expect(within(nav).getByText("pagination.newer")).toHaveAttribute(
      "href",
      "/articles/series/signal/page/2",
    );
    expect(within(nav).getByText("1")).toHaveAttribute(
      "href",
      "/articles/series/signal",
    );
  });

  it("formats English date headings", async () => {
    render(
      await ArticleSeriesPage({
        params: Promise.resolve({ locale: "en", series: "signal" }),
      }),
    );
    const headings = within(screen.getByRole("main")).getAllByRole("heading", {
      level: 2,
    });
    expect(headings[0].textContent).toBe("Fri, Oct 2");
  });

  it("returns not found past the last page and for non-canonical page segments", async () => {
    for (const page of ["4", "0", "02", "abc"]) {
      await expect(
        ArticleSeriesPagedPage({
          params: Promise.resolve({ locale: "ja", series: "signal", page }),
        }),
        page,
      ).rejects.toThrow("NEXT_NOT_FOUND");
    }
    await expect(
      ArticleSeriesPagedPage({
        params: Promise.resolve({ locale: "ja", series: "unknown", page: "2" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("redirects /page/1 to the series root URL", async () => {
    await expect(
      ArticleSeriesPagedPage({
        params: Promise.resolve({ locale: "ja", series: "signal", page: "1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: "/articles/series/signal",
      locale: "ja",
    });
  });

  it("draws no pagination for a single-page series", async () => {
    render(
      await ArticleSeriesPage({
        params: Promise.resolve({ locale: "ja", series: "deep-dive" }),
      }),
    );
    expect(rowIds()).toEqual(["deep-dive-x"]);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByTestId("series-page-indicator")).toBeNull();
  });
});
