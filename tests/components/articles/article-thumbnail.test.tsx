/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// FAMILY_COLORS の re-export 元 (ArticleRow) が Link を import するため
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

import { ArticleThumbnail } from "@/components/articles/ArticleThumbnail";

const URL = "https://p80f4ywborfbatou.public.blob.vercel-storage.com/livemakers/thumbnails/a/aa.webp";

describe("ArticleThumbnail (INFLOW-G2 D4)", () => {
  it("renders a 16:9 image with the article title as alt when present", () => {
    const { container } = render(
      <ArticleThumbnail thumbnailUrl={URL} family="signal" title="記事タイトル" variant="fixed" />,
    );
    const frame = container.querySelector('[data-article-thumbnail="present"]')!;
    expect(frame.className).toContain("aspect-[16/9]");
    const img = frame.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(URL);
    expect(img.getAttribute("alt")).toBe("記事タイトル");
    expect(img.getAttribute("width")).toBe("1600");
    expect(img.getAttribute("height")).toBe("900");
  });

  it("keeps the fixed 16:9 frame for the placeholder (CLS ゼロ)", () => {
    const { container } = render(
      <ArticleThumbnail thumbnailUrl={undefined} family="signal" title="t" variant="fixed" />,
    );
    const frame = container.querySelector('[data-article-thumbnail="placeholder"]')!;
    expect(frame.className).toContain("aspect-[16/9]");
    expect(frame.querySelector("img")).toBeNull();
    expect((frame as HTMLElement).style.background).toContain("linear-gradient");
  });

  it("keeps the current h-24 band for the lead placeholder (寸法変更なし)", () => {
    const { container } = render(
      <ArticleThumbnail thumbnailUrl={undefined} family="signal" title="t" variant="lead" />,
    );
    const frame = container.querySelector('[data-article-thumbnail="placeholder"]')!;
    expect(frame.className).toContain("h-24");
    expect(frame.className).not.toContain("aspect-[16/9]");
  });
});
