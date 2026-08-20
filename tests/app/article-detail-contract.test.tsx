/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculateArticleBodyChecksum } from "@/lib/articles/article-inflow-contract";
import type { ArticleMeta } from "@/lib/articles/article-model";
import {
  collectScannableText,
  findForbiddenDesignTerms,
  findForbiddenOpsTerms,
  findLiveTokenViolations,
} from "@/lib/home/reader-grammar";
import {
  isAllowedChromeRoute,
  isAllowedPublishedArticleRoute,
} from "@/lib/livemakers-terminal-preview/public-topology";
import ja from "@/messages/ja.json";
import en from "@/messages/en.json";

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
  MDXRemote: ({ source }: { source: string }) => (
    <div data-testid="rendered-markdown">{source}</div>
  ),
}));
vi.mock("remark-gfm", () => ({ default: vi.fn() }));
vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: mocks.loadCatalog,
  loadPublicArticleInflowDetail: mocks.loadDetail,
}));
vi.mock("@/lib/future-atlas/surface", () => ({
  // T4-2: 実効 surface は config 値へ縮退させる (feed 照会は結合対象外)
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
vi.mock("@/components/future-atlas/ArticleContractBlock", () => ({
  ArticleContractBlock: () => null,
}));
vi.mock("@/components/future-atlas/AuthorshipLine", () => ({
  AuthorshipLine: () => null,
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

import ArticleDetailPage from "@/app/[locale]/articles/[slug]/page";

const article = (
  articleId: string,
  family: ArticleMeta["family"],
  publishedAtJst: string,
  lanes: ArticleMeta["lanes"] = [],
): ArticleMeta => ({
  articleId,
  family,
  titleJa: `記事 ${articleId}`,
  publishedAtJst,
  publishedLabel: publishedAtJst.slice(5, 16),
  lanes,
  href: `/articles/${articleId}`,
});

const catalog: ArticleMeta[] = [
  article("sig-new", "signal", "2026-07-09T08:00:00+09:00", ["crypto"]),
  article("sig-mid", "signal", "2026-07-05T08:00:00+09:00", ["crypto"]),
  article("sig-old", "signal", "2026-07-01T08:00:00+09:00"),
  article("intel-1", "daily-intel", "2026-07-08T08:00:00+09:00", ["crypto"]),
  ...Array.from({ length: 5 }, (_, index) =>
    article(`dd-${index + 1}`, "deep-dive", `2026-07-0${5 - Math.min(index, 4)}T09:00:00+09:00`),
  ),
  article("map-1", "future-map", "2026-07-04T08:00:00+09:00"),
  article("mkt-am", "mkt12-morning", "2026-07-09T06:00:00+09:00"),
  article("mkt-we", "mkt12-weekend", "2026-07-05T06:00:00+09:00"),
  article("err-1", "event-risk-radar", "2026-07-07T06:00:00+09:00"),
];

const LONG_BODY = [
  "リード文。",
  "## 何が起きたか",
  "本文。",
  "```bash",
  "## コードフェンス内は見出しではない",
  "```",
  "## なぜ動いたか",
  "本文。",
  "## 数値の床",
  "本文。",
  "## 次に見るもの",
  "締め。",
].join("\n");

const SHORT_BODY = ["リード文。", "## 単独見出し", "本文。", "## 二つ目", "締め。"].join("\n");

function mockDetail(current: ArticleMeta, body: string) {
  mocks.loadDetail.mockResolvedValue({
    article: current,
    body,
    declaredBodyChecksum: "c0ffee",
    renderedBodyChecksum: "c0ffee",
  });
}

async function renderDetail(slug: string) {
  return render(
    await ArticleDetailPage({
      params: Promise.resolve({ locale: "ja", slug }),
    }),
  );
}

beforeEach(() => {
  mocks.loadCatalog.mockResolvedValue({ articles: catalog });
  mockDetail(catalog[1], LONG_BODY);
  mocks.notFound.mockClear();
});

describe("article detail two-column contract (G44 D9/D10)", () => {
  it("lays out body and rail as two columns while keeping the reading width", async () => {
    const { container } = await renderDetail("sig-mid");
    const layout = container.querySelector("[data-article-layout]")!;
    expect(layout.className).toContain("lg:grid");
    const body = container.querySelector("article")!;
    expect(body.className).toContain("max-w-[80ch]");
    const rail = container.querySelector("[data-article-rail]")!;
    expect(rail.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("renders the nine-section rail with the current series first and current article excluded", async () => {
    const { container } = await renderDetail("sig-mid");
    const sections = [...container.querySelectorAll("[data-rail-section]")].map(
      (element) => element.getAttribute("data-rail-section"),
    );
    expect(sections).toEqual([
      "signal",
      "session-terminal",
      "daily-intel",
      "latest-articles",
      "mkt12-morning",
      "event-risk-radar",
      "future-atlas",
      "mkt12-weekend",
      "weekly-brief",
    ]);
    expect(
      container.querySelectorAll('[data-rail-section="latest-articles"] [data-article-id]'),
    ).toHaveLength(catalog.length - 1);
    expect(
      container.querySelector('[data-rail-section="latest-articles"] [data-article-id="sig-mid"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-rail-section="signal"] [data-article-id="sig-mid"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-rail-section="future-atlas"] a[href="/articles/series/future-map"]'),
    ).not.toBeNull();
  });

  it("links the same-series neighbors and drops the missing side at the edges", async () => {
    const { container } = await renderDetail("sig-mid");
    const nav = container.querySelector("[data-article-prev-next]")!;
    expect(nav.querySelector("[data-prev]")!.getAttribute("href")).toBe("/articles/sig-old");
    expect(nav.querySelector("[data-next]")!.getAttribute("href")).toBe("/articles/sig-new");

    mockDetail(catalog[0], LONG_BODY);
    const edge = await renderDetail("sig-new");
    const edgeNav = edge.container.querySelector("[data-article-prev-next]")!;
    expect(edgeNav.querySelector("[data-prev]")).not.toBeNull();
    expect(edgeNav.querySelector("[data-next]")).toBeNull();
  });

  it("lists up to four related articles excluding the current one", async () => {
    const { container } = await renderDetail("sig-mid");
    const related = container.querySelectorAll("[data-article-related] [data-article-id]");
    expect(related.length).toBeGreaterThanOrEqual(2);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(
      container.querySelector('[data-article-related] [data-article-id="sig-mid"]'),
    ).toBeNull();
  });

  it("shows the toc only for long bodies and anchors every h2", async () => {
    const { container } = await renderDetail("sig-mid");
    const toc = container.querySelector("[data-article-toc]")!;
    const anchors = [...toc.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(anchors).toEqual([
      "#何が起きたか",
      "#なぜ動いたか",
      "#数値の床",
      "#次に見るもの",
    ]);

    mockDetail(catalog[1], SHORT_BODY);
    const short = await renderDetail("sig-mid");
    expect(short.container.querySelector("[data-article-toc]")).toBeNull();
  });

  it("builds the toc from standalone ■ marker lines (X 公開体裁の mirror 本文)", async () => {
    const markerBody = [
      "リード文。",
      "",
      "■ 発表されたこと",
      "",
      "本文。",
      "",
      "■ 三日で二件",
      "",
      "本文。",
      "",
      "■ 今後 48-72 時間",
      "",
      "・観察点",
    ].join("\n");
    mockDetail(catalog[1], markerBody);
    const { container } = await renderDetail("sig-mid");
    const anchors = [...container.querySelectorAll("[data-article-toc] a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(anchors).toEqual([
      "#■-発表されたこと",
      "#■-三日で二件",
      "#■-今後-48-72-時間",
    ]);
  });

  it("separates source / display checksums with an inert transform (INFLOW-G2 T1a)", async () => {
    mockDetail(catalog[1], LONG_BODY);
    const { container } = await renderDetail("sig-mid");
    const body = container.querySelector('[data-testid="article-inflow-public-body"]')!;
    // alias (rendered) と source は同値・同義 (受領 body の checksum)
    expect(body.getAttribute("data-source-body-checksum")).toBe(
      body.getAttribute("data-rendered-body-checksum"),
    );
    // transform inert (none) の間、display は受領 body の実 checksum に一致
    expect(body.getAttribute("data-display-body-checksum")).toBe(
      calculateArticleBodyChecksum(LONG_BODY),
    );
    expect(body.getAttribute("data-display-transform-id")).toBe("none");
    expect(body.getAttribute("data-declared-body-checksum")).toBe("c0ffee");
  });

  it("renders the thumbnail placeholder frame on the detail hero (CLS ゼロ)", async () => {
    mockDetail(catalog[1], LONG_BODY);
    const { container } = await renderDetail("sig-mid");
    const frame = container.querySelector("article [data-article-thumbnail]")!;
    expect(frame.getAttribute("data-article-thumbnail")).toBe("placeholder");
    expect(frame.className).toContain("aspect-[16/9]");

    mockDetail(
      {
        ...catalog[1],
        thumbnailUrl:
          "https://p80f4ywborfbatou.public.blob.vercel-storage.com/livemakers/thumbnails/a/aa.webp",
      },
      LONG_BODY,
    );
    const withImage = await renderDetail("sig-mid");
    const present = withImage.container.querySelector(
      'article [data-article-thumbnail="present"]',
    )!;
    expect(present).not.toBeNull();
    expect(present.querySelector("img")!.getAttribute("alt")).toContain("記事");
  });

  it("shows the excerpt as a dek under the header only when the article carries one", async () => {
    mockDetail(
      { ...catalog[1], excerptJa: "一段落の要約テキスト。" },
      LONG_BODY,
    );
    const withExcerpt = await renderDetail("sig-mid");
    const dek = withExcerpt.container.querySelector("[data-article-excerpt]")!;
    expect(dek).not.toBeNull();
    expect(dek.textContent).toBe("一段落の要約テキスト。");

    mockDetail(catalog[1], LONG_BODY);
    const without = await renderDetail("sig-mid");
    expect(without.container.querySelector("[data-article-excerpt]")).toBeNull();
  });

  it("keeps every rail / prev-next / related link inside the public ledgers", async () => {
    const { container } = await renderDetail("sig-mid");
    const anchors = container.querySelectorAll(
      "[data-article-rail] a[href], [data-article-prev-next] a[href], [data-article-related] a[href]",
    );
    expect(anchors.length).toBeGreaterThan(10);
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href")!;
      expect(
        isAllowedPublishedArticleRoute(href) || isAllowedChromeRoute(href),
        `link outside ledgers: ${href}`,
      ).toBe(true);
    }
  });

  it("keeps the reader vocabulary clean on the detail surface and in the real labels", async () => {
    const { container } = await renderDetail("sig-mid");
    const text = collectScannableText(container);
    expect(findForbiddenOpsTerms(text)).toEqual([]);
    expect(findForbiddenDesignTerms(text)).toEqual([]);
    expect(findLiveTokenViolations(text)).toEqual([]);

    for (const messages of [ja, en]) {
      const values = JSON.stringify(
        (messages as { articles: unknown }).articles,
      );
      expect(findForbiddenOpsTerms(values)).toEqual([]);
      expect(findForbiddenDesignTerms(values)).toEqual([]);
      expect(findLiveTokenViolations(values)).toEqual([]);
    }
  });
});
