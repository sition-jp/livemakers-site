/* @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ articles: [] as unknown[] }));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock("@/i18n/navigation", () => ({
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
    feedPresent: true,
  })),
}));

vi.mock("@/lib/articles/latest-articles-rail", () => ({
  loadLatestArticlesRail: vi.fn(async () => ({
    articles: [],
    copy: { title: "rail" },
  })),
}));

vi.mock("@/lib/home/resolve-today", () => ({
  resolveTodayJst: () => "2026-10-02",
}));

import SearchPage, { generateMetadata } from "@/app/[locale]/search/page";

function a(
  id: string,
  family: string,
  titleJa: string,
  publishedAtJst: string,
  excerptJa?: string,
) {
  return {
    articleId: id,
    family,
    titleJa,
    excerptJa,
    publishedAtJst,
    publishedLabel: "公開",
    lanes: [],
    href: `/articles/${id}`,
  };
}

async function renderSearch(searchParams: Record<string, string>) {
  render(
    await SearchPage({
      params: Promise.resolve({ locale: "ja" }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

const main = () => screen.getByRole("main");
const rowIds = () =>
  [...within(main()).queryAllByRole("link")]
    .map((link) => link.getAttribute("data-article-id"))
    .filter(Boolean);

beforeEach(() => {
  mocks.articles = [
    a("s1", "signal", "Midnight 解説", "2026-10-02T08:00:00+09:00"),
    a("d1", "deep-dive", "週次", "2026-10-01T08:00:00+09:00", "Midnight の背景"),
    a("s2", "signal", "Midnight 続報", "2026-09-30T08:00:00+09:00"),
    a("x1", "signal", "無関係", "2026-09-30T07:00:00+09:00"),
  ];
});

describe("/search page (2026-10-02 spec)", () => {
  it("lists title matches first, then other matches, with counts and family tabs", async () => {
    await renderSearch({ q: "midnight" });
    expect(rowIds()).toEqual(["s1", "s2", "d1"]);
    expect(within(main()).getByText('count:{"count":3}')).toBeTruthy();
    const tabs = within(main()).getByRole("navigation", {
      name: "familyFilterLabel",
    });
    expect(
      [...tabs.querySelectorAll("a")].map((link) => [
        link.textContent,
        link.getAttribute("href"),
      ]),
    ).toEqual([
      ["all3", "/search?q=midnight"],
      ["family.signal2", "/search?q=midnight&family=signal"],
      ["family.deep-dive1", "/search?q=midnight&family=deep-dive"],
    ]);
    expect(within(main()).getByText("titleTier")).toBeTruthy();
    expect(within(main()).getByText("otherTier")).toBeTruthy();
  });

  it("filters by family and marks the active tab", async () => {
    await renderSearch({ q: "midnight", family: "deep-dive" });
    expect(rowIds()).toEqual(["d1"]);
    const active = within(main())
      .getByRole("navigation", { name: "familyFilterLabel" })
      .querySelector('[aria-current="page"]');
    expect(active?.textContent).toBe("family.deep-dive1");
  });

  it("highlights the term in titles", async () => {
    await renderSearch({ q: "midnight" });
    expect(
      within(main()).getAllByText("Midnight", { selector: "mark" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows the empty state with series links", async () => {
    await renderSearch({ q: "存在しない語" });
    expect(rowIds()).toEqual([]);
    expect(
      within(main()).getByText('empty:{"q":"存在しない語"}'),
    ).toBeTruthy();
    expect(
      within(main())
        .getByRole("link", { name: "family.signal" })
        .getAttribute("href"),
    ).toBe("/articles/series/signal");
  });

  it("shows only the prompt when q is empty", async () => {
    await renderSearch({});
    expect(rowIds()).toEqual([]);
    expect(within(main()).getByText("promptHint")).toBeTruthy();
  });

  it("falls back to page 1 for out-of-range pages", async () => {
    await renderSearch({ q: "midnight", page: "9" });
    expect(rowIds()).toEqual(["s1", "s2", "d1"]);
  });
});

describe("/search metadata", () => {
  it("is noindex,follow with a q-less canonical", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "ja" }),
      searchParams: Promise.resolve({ q: "ada" }),
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe("/ja/search");
    expect(meta.title).toBe('resultsHeading:{"q":"ada"}');
  });
});
