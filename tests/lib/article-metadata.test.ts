import { describe, it, expect } from "vitest";
import { buildArticleMetadata } from "@/lib/articles/article-metadata";

/**
 * 2026-08-07 incident: 記事詳細ページに generateMetadata が無く、root
 * layout の既定 metadata (サイト共通タイトル / og:image なし /
 * twitter:card=summary / og:locale=en_US) がそのまま X へ渡っていた。
 * X 側のカードは記事サムネではなくサイト説明文の灰色カードになる。
 *
 * サムネ自体は Blob に存在し、ページ内では表示されていた —
 * 欠けていたのは「外向きに宣言する」層だけ。
 */

const BASE = {
  articleId: "signal-20260807-089db35f",
  titleJa: "📡 Signal｜Circle Arc の創設バリデータに BlackRock・Visa・DTCC",
  publishedAtJst: "2026-08-07T18:18:00+09:00",
  thumbnailUrl:
    "https://p80f4ywborfbatou.public.blob.vercel-storage.com/livemakers/articles/signal-20260807-089db35f/thumbnail.webp",
} as const;

describe("lib/articles/article-metadata", () => {
  describe("title", () => {
    it("uses the article title, not the site-wide default", () => {
      const meta = buildArticleMetadata({ article: BASE, lang: "ja" });
      expect(meta.title).toBe(BASE.titleJa);
      expect(meta.openGraph?.title).toBe(BASE.titleJa);
      expect(meta.twitter?.title).toBe(BASE.titleJa);
    });

    it("prefers titleEn under the en locale", () => {
      const meta = buildArticleMetadata({
        article: { ...BASE, titleEn: "Circle Arc founding validators" },
        lang: "en",
      });
      expect(meta.title).toBe("Circle Arc founding validators");
    });

    it("falls back to titleJa when titleEn is absent", () => {
      const meta = buildArticleMetadata({ article: BASE, lang: "en" });
      expect(meta.title).toBe(BASE.titleJa);
    });
  });

  describe("og:image", () => {
    it("exposes the Blob thumbnail as the og image", () => {
      const meta = buildArticleMetadata({ article: BASE, lang: "ja" });
      expect(meta.openGraph?.images).toEqual([
        { url: BASE.thumbnailUrl, width: 1600, height: 900, alt: BASE.titleJa },
      ]);
      expect(meta.twitter?.images).toEqual([BASE.thumbnailUrl]);
    });

    it("uses summary_large_image when a thumbnail exists", () => {
      const meta = buildArticleMetadata({ article: BASE, lang: "ja" });
      expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    });

    it("omits images and degrades the card when no thumbnail exists", () => {
      // placeholder 記事 (mirror lane 例外) はサムネを持たない。
      // 存在しない画像 URL を宣言して X 側で壊れるより、宣言しない。
      const meta = buildArticleMetadata({
        article: { ...BASE, thumbnailUrl: undefined },
        lang: "ja",
      });
      expect(meta.openGraph?.images).toBeUndefined();
      expect(meta.twitter?.images).toBeUndefined();
      expect(meta.twitter).toMatchObject({ card: "summary" });
    });
  });

  describe("description", () => {
    it("uses the article excerpt", () => {
      const meta = buildArticleMetadata({
        article: { ...BASE, excerptJa: "Circle が 9 月 16 日に立ち上げる L1「Arc」。" },
        lang: "ja",
      });
      expect(meta.description).toBe("Circle が 9 月 16 日に立ち上げる L1「Arc」。");
      expect(meta.openGraph?.description).toBe(meta.description);
      expect(meta.twitter?.description).toBe(meta.description);
    });

    it("strips markdown markers out of the excerpt", () => {
      const meta = buildArticleMetadata({
        article: { ...BASE, excerptJa: "**Circle** が [Arc](https://example.com) を立ち上げる。" },
        lang: "ja",
      });
      expect(meta.description).toBe("Circle が Arc を立ち上げる。");
    });

    it("truncates a long JA excerpt to 180 chars", () => {
      const meta = buildArticleMetadata({
        article: { ...BASE, excerptJa: "あ".repeat(400) },
        lang: "ja",
      });
      expect(Array.from(meta.description as string)).toHaveLength(180);
      expect(meta.description as string).toMatch(/…$/);
    });

    it("truncates a long EN excerpt to 200 chars", () => {
      const meta = buildArticleMetadata({
        article: { ...BASE, excerptJa: "a".repeat(400) },
        lang: "en",
      });
      expect(Array.from(meta.description as string)).toHaveLength(200);
    });

    it("falls back to the body lead when the excerpt is absent", () => {
      const meta = buildArticleMetadata({
        article: BASE,
        lang: "ja",
        body: "## 見出し\n\nCircle が 9 月 16 日に立ち上げる L1「Arc」の創設バリデータ 11 社を公表した。\n\n次の段落。",
      });
      expect(meta.description).toBe(
        "Circle が 9 月 16 日に立ち上げる L1「Arc」の創設バリデータ 11 社を公表した。",
      );
    });

    it("omits the description when neither excerpt nor body is available", () => {
      // 継承させない: root layout のサイト共通 description が降りてくると
      // 記事ごとに違う説明文という前提が崩れる — が、嘘の説明文を作るより
      // 無い方がよい (X は og:title と画像でカードを組める)。
      const meta = buildArticleMetadata({ article: BASE, lang: "ja" });
      expect(meta.description).toBeUndefined();
      expect(meta.openGraph?.description).toBeUndefined();
    });
  });

  describe("locale / type", () => {
    it("declares ja_JP for the ja locale", () => {
      const meta = buildArticleMetadata({ article: BASE, lang: "ja" });
      expect(meta.openGraph).toMatchObject({ locale: "ja_JP", type: "article" });
    });

    it("declares en_US for the en locale", () => {
      const meta = buildArticleMetadata({ article: BASE, lang: "en" });
      expect(meta.openGraph).toMatchObject({ locale: "en_US" });
    });

    it("carries the publish time and the locale-correct canonical url", () => {
      const meta = buildArticleMetadata({ article: BASE, lang: "ja" });
      expect(meta.openGraph).toMatchObject({
        publishedTime: BASE.publishedAtJst,
        url: `/ja/articles/${BASE.articleId}`,
        siteName: "LiveMakers",
      });
      expect(meta.alternates?.canonical).toBe(`/ja/articles/${BASE.articleId}`);
    });
  });
});
