import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 2026-08-07 incident の再発防止: 記事詳細ページが `generateMetadata` を
 * 持たないと root layout のサイト共通 metadata がそのまま X へ渡り、
 * カードは記事サムネではなくサイト説明文の灰色カードになる。
 * ここで守るのは「route が記事固有の metadata を出すこと」そのもの。
 */

const mocks = vi.hoisted(() => ({ loadDetail: vi.fn() }));

// page module を import すると RSC 依存が芋づるで載るため、
// tests/app/article-inflow-public-routes.test.tsx と同じ境界で切る。
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next-mdx-remote/rsc", () => ({ MDXRemote: () => null }));
vi.mock("remark-gfm", () => ({ default: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: vi.fn(),
  loadPublicArticleInflowDetail: mocks.loadDetail,
}));

import { generateMetadata } from "@/app/[locale]/articles/[slug]/page";

const article = {
  articleId: "signal-20260807-089db35f",
  family: "signal",
  titleJa: "📡 Signal｜Circle Arc の創設バリデータに BlackRock・Visa・DTCC",
  publishedAtJst: "2026-08-07T18:18:00+09:00",
  publishedLabel: "08-07 18:18 公開",
  lanes: [],
  href: "/articles/signal-20260807-089db35f",
  source: "inflow",
  excerptJa: "Circle が 9 月 16 日に立ち上げる L1「Arc」の創設バリデータ 11 社。",
  thumbnailUrl:
    "https://p80f4ywborfbatou.public.blob.vercel-storage.com/livemakers/articles/signal-20260807-089db35f/thumbnail.webp",
};

beforeEach(() => {
  mocks.loadDetail.mockReset();
  mocks.loadDetail.mockResolvedValue({ article, body: "# body\n" });
});

describe("article detail generateMetadata", () => {
  it("emits the article's own title, description, image and card type", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "ja", slug: article.articleId }),
    });

    expect(meta.title).toBe(article.titleJa);
    expect(meta.description).toBe(article.excerptJa);
    expect(meta.openGraph?.images).toEqual([
      {
        url: article.thumbnailUrl,
        width: 1600,
        height: 900,
        alt: article.titleJa,
      },
    ]);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.openGraph).toMatchObject({ locale: "ja_JP", type: "article" });
  });

  it("returns empty metadata for an unknown slug instead of throwing", async () => {
    mocks.loadDetail.mockResolvedValue(null);

    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "ja", slug: "does-not-exist" }),
    });

    expect(meta).toEqual({});
  });

  it("resolves the en locale against the same detail loader", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "en", slug: article.articleId }),
    });

    expect(mocks.loadDetail).toHaveBeenCalledWith(article.articleId, "en");
    expect(meta.openGraph).toMatchObject({ locale: "en_US" });
  });
});
