/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 記事ページの種類のバッジ (2026-11-16 題のラベルを外す設計 §5-2・§5-3)。
 * 印付きで出し、シリーズの一覧ページがある種類は一覧へのリンクにする。
 * 一覧ページの無い種類 (session・future-atlas) はリンクにしない。
 * mock 境界は article-detail-json-ld-and-date.test.tsx と同じ。
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
vi.mock("@/lib/articles/article-model", async () => {
  const actual = await vi.importActual<typeof import("@/lib/articles/article-model")>(
    "@/lib/articles/article-model",
  );
  return {
    SERIES_SLUGS: actual.SERIES_SLUGS,
    ARTICLE_FAMILIES: actual.ARTICLE_FAMILIES,
    getAllArticles: vi.fn(() => []),
  };
});
vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: mocks.loadCatalog,
  loadPublicArticleInflowDetail: mocks.loadDetail,
}));
vi.mock("@/lib/future-atlas/surface", () => ({
  loadEffectiveSurfacePublished: vi.fn(async () => false),
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => ({
    manifest: { entries: [] },
    contracts: [],
    states: new Map(),
    config: { surfacePublished: false },
  })),
}));
vi.mock("@/components/future-atlas/ArticleContractBlock", () => ({
  ArticleContractBlock: () => null,
}));
vi.mock("@/components/future-atlas/AuthorshipLine", () => ({ AuthorshipLine: () => null }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ArticleDetailPage from "@/app/[locale]/articles/[slug]/page";

function articleOf(family: string, articleId: string) {
  return {
    articleId,
    family,
    titleJa: "見出しだけの題",
    publishedAtJst: "2026-11-16T07:00:00+09:00",
    publishedLabel: "11-16 07:00 公開",
    lanes: [],
    href: `/articles/${articleId}`,
    source: "inflow",
  };
}

async function renderPage(family: string, articleId: string) {
  const article = articleOf(family, articleId);
  mocks.loadCatalog.mockResolvedValue({ articles: [article], feedChecksum: null });
  mocks.loadDetail.mockResolvedValue({
    article,
    body: "本文\n",
    declaredBodyChecksum: "x",
    renderedBodyChecksum: "x",
  });
  const { container } = render(
    await ArticleDetailPage({ params: Promise.resolve({ locale: "ja", slug: articleId }) }),
  );
  // ヘッダーのバッジ (右レールの行のバッジと区別する)
  return container.querySelector("article header [data-family-badge]")!;
}

beforeEach(() => {
  mocks.notFound.mockClear();
});

describe("article detail: family badge", () => {
  it("shows the mark and links to the series list", async () => {
    const badge = await renderPage("signal", "signal-20261116-aaaa1111");
    expect(badge.tagName).toBe("A");
    expect(badge).toHaveAttribute("href", "/articles/series/signal");
    expect(badge).toHaveTextContent("📡 family.signal");
  });

  it.each([
    ["daily-intel", "📋"],
    ["deep-dive", "🔬"],
    ["weekly-brief", "📊"],
    ["landmark", "📍"],
    ["event-risk-radar", "📌"],
    ["restart-map", "🗺️"],
  ])("links %s to its own series list", async (family, mark) => {
    const badge = await renderPage(family, `${family}-20261116-bbbb2222`);
    expect(badge.tagName).toBe("A");
    expect(badge).toHaveAttribute("href", `/articles/series/${family}`);
    expect(badge.textContent).toBe(`${mark} family.${family}`);
  });

  it.each(["session", "future-atlas"])(
    "does not link %s (no series list page)",
    async (family) => {
      const badge = await renderPage(family, `${family}-20261116-cccc3333`);
      expect(badge).not.toBeNull();
      expect(badge.tagName).toBe("SPAN");
      expect(badge.closest("a")).toBeNull();
      expect(badge.textContent).toBe(`family.${family}`);
    },
  );
});
