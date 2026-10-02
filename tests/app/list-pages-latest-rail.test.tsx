/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import ja from "@/messages/ja.json";

const { catalogArticles } = vi.hoisted(() => {
  const article = (
    articleId: string,
    family: ArticleMeta["family"],
    publishedAtJst: string,
  ): ArticleMeta => ({
    articleId,
    family,
    titleJa: `記事 ${articleId}`,
    publishedAtJst,
    publishedLabel: publishedAtJst.slice(5, 16),
    lanes: [],
    href: `/articles/${articleId}`,
  });
  const signals = Array.from({ length: 22 }, (_, index) =>
    article(
      `sig-${index}`,
      "signal",
      `2026-09-${String(index + 1).padStart(2, "0")}T08:00:00+09:00`,
    ),
  );
  return {
    catalogArticles: [
      article("flash-1", "flash", "2026-09-30T09:00:00+09:00"),
      article("wb-1", "weekly-brief", "2026-09-26T08:16:00+09:00"),
      ...signals,
    ],
  };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string) => key,
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
    articles: catalogArticles,
    feedChecksum: null,
  })),
}));

const { surface } = vi.hoisted(() => ({ surface: { published: false } }));
vi.mock("@/lib/future-atlas/surface", () => ({
  loadEffectiveSurfacePublished: vi.fn(async () => surface.published),
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => ({
    config: { surfacePublished: surface.published },
    manifest: { themes: [], entries: [] },
    contracts: [],
    states: new Map(),
    articles: new Map(),
  })),
}));

import AboutPage from "@/app/[locale]/about/page";
import FutureAtlasPage from "@/app/[locale]/future-atlas/page";
import ArticleSeriesPage from "@/app/[locale]/articles/series/[series]/page";
import SessionArchivePage from "@/app/[locale]/sessions/archive/page";
import SessionArchivePastPage from "@/app/[locale]/sessions/archive/past/page";

const railRowIds = (): string[] =>
  Array.from(
    document.querySelectorAll(
      "[data-latest-articles-rail] [data-article-id]",
    ),
  ).map((node) => node.getAttribute("data-article-id")!);

const expectHomeEquivalentRail = () => {
  const rail = document.querySelector("[data-latest-articles-rail]");
  expect(rail).not.toBeNull();
  expect(rail!.textContent).toContain("gradient.latestTitle");
  const ids = railRowIds();
  // ホーム右カラム⑤と同じ: 20 本・新しい順・速報 (flash) なし
  expect(ids).toHaveLength(20);
  expect(ids[0]).toBe("wb-1");
  expect(ids[1]).toBe("sig-21");
  expect(ids).not.toContain("flash-1");
  for (const node of document.querySelectorAll(
    "[data-latest-articles-rail] [data-article-id]",
  )) {
    expect(node.hasAttribute("data-index-nav")).toBe(true);
  }
};

describe("list pages carry the latest-articles rail", () => {
  it.each(["flash", "signal", "weekly-brief", "future-map"])(
    "series page %s",
    async (series) => {
      const page = await ArticleSeriesPage({
        params: Promise.resolve({ locale: "ja", series }),
      });
      render(page);
      expectHomeEquivalentRail();
      // 本体の一覧は従来どおり当該シリーズのみ (rail 外の行)
      const bodyIds = Array.from(
        document.querySelectorAll("main [data-article-id]"),
      ).map((node) => node.getAttribute("data-article-id"));
      expect(
        bodyIds.every((id) =>
          catalogArticles.find((article) => article.articleId === id)?.family ===
          series,
        ),
      ).toBe(true);
    },
  );

  it("Intelligence Terminal archive (recent and past)", async () => {
    const { unmount } = render(
      await SessionArchivePage({ params: Promise.resolve({ locale: "ja" }) }),
    );
    expectHomeEquivalentRail();
    unmount();
    render(
      await SessionArchivePastPage({ params: Promise.resolve({ locale: "ja" }) }),
    );
    expectHomeEquivalentRail();
  });

  it("Future Atlas page (surface published)", async () => {
    surface.published = true;
    try {
      render(
        <NextIntlClientProvider locale="ja" messages={ja}>
          {await FutureAtlasPage({ params: Promise.resolve({ locale: "ja" }) })}
        </NextIntlClientProvider>,
      );
      expectHomeEquivalentRail();
    } finally {
      surface.published = false;
    }
  });

  it("About page", async () => {
    render(await AboutPage({ params: Promise.resolve({ locale: "ja" }) }));
    expectHomeEquivalentRail();
  });
});
