import { describe, expect, it } from "vitest";

import { buildArticleJsonLd } from "@/lib/seo/article-json-ld";

const BASE = {
  articleId: "signal-20260807-089db35f",
  titleJa: "📡 Signal｜Circle Arc の創設バリデータに BlackRock・Visa・DTCC",
  publishedAtJst: "2026-08-07T18:18:00+09:00",
  family: "signal" as const,
  thumbnailUrl: "https://example.com/thumb.webp",
  lang: "ja" as const,
};

describe("lib/seo/article-json-ld", () => {
  it("declares the NewsArticle type with required fields", () => {
    const json = buildArticleJsonLd(BASE);
    expect(json["@type"]).toBe("NewsArticle");
    expect(json.headline).toBe(BASE.titleJa);
    expect(json.datePublished).toBe(BASE.publishedAtJst);
    expect(json.dateModified).toBe(BASE.publishedAtJst);
    expect(json.isAccessibleForFree).toBe(true);
    expect(json.inLanguage).toBe("ja");
  });

  it("sets author to the editorial desk organization with the about url", () => {
    const json = buildArticleJsonLd(BASE);
    expect(json.author).toEqual({
      "@type": "Organization",
      name: "LiveMakers 編集デスク",
      url: "https://livemakers.com/ja/about",
    });
  });

  it("sets publisher with a real (non-SVG) logo", () => {
    const json = buildArticleJsonLd(BASE);
    expect(json.publisher).toEqual({
      "@type": "Organization",
      name: "LiveMakers",
      logo: {
        "@type": "ImageObject",
        url: "https://livemakers.com/apple-icon.png",
        width: 180,
        height: 180,
      },
    });
  });

  it("uses the family label as articleSection", () => {
    const json = buildArticleJsonLd(BASE);
    expect(json.articleSection).toBe("Signal");
  });

  it("includes image only when a thumbnail exists", () => {
    const withThumb = buildArticleJsonLd(BASE);
    expect(withThumb.image).toEqual(["https://example.com/thumb.webp"]);
    const withoutThumb = buildArticleJsonLd({ ...BASE, thumbnailUrl: undefined });
    expect(withoutThumb.image).toBeUndefined();
  });

  it("mainEntityOfPage points at the locale-correct canonical url", () => {
    const ja = buildArticleJsonLd(BASE);
    expect(ja.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": `https://livemakers.com/ja/articles/${BASE.articleId}`,
    });
    const en = buildArticleJsonLd({ ...BASE, lang: "en" });
    expect(en.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": `https://livemakers.com/en/articles/${BASE.articleId}`,
    });
  });
});
