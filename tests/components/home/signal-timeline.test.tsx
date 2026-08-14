/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SignalTimeline } from "@/components/home/SignalTimeline";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { buildTestHomeCopy } from "@/lib/home/home-copy";

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

const THUMB =
  "https://p80f4ywborfbatou.public.blob.vercel-storage.com/livemakers/thumbnails/s/s1.webp";

function article(overrides: Partial<ArticleMeta>): ArticleMeta {
  return {
    articleId: "signal-x",
    family: "signal",
    titleJa: "📡 Signal｜テスト",
    href: "/articles/signal-x",
    publishedLabel: "08-14 08:00 公開",
    lanes: [],
    ...overrides,
  } as ArticleMeta;
}

const copy = {
  title: buildTestHomeCopy().gradient.signalTitle,
  familyLabels: buildTestHomeCopy().familyLabels,
};

describe("SignalTimeline lead thumbnail (Phase 3, 2026-08-14)", () => {
  it("renders a small 16:9 thumbnail on the first row only", () => {
    const { container } = render(
      <SignalTimeline
        articles={[
          article({ articleId: "s1", thumbnailUrl: THUMB }),
          article({ articleId: "s2", titleJa: "📡 Signal｜2本目" }),
        ]}
        copy={copy}
      />,
    );
    const lead = container.querySelector("[data-signal-lead]")!;
    expect(lead).not.toBeNull();
    expect(lead.getAttribute("data-article-id")).toBe("s1");
    const img = lead.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(THUMB);
    expect(img.className).toContain("object-cover");
    // 2 本目以降はサムネなしの ArticleRow
    const rows = container.querySelectorAll("a[data-article-id]");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.querySelector("img")).toBeNull();
  });

  it("keeps the frame with a family gradient when the lead has no thumbnail", () => {
    const { container } = render(
      <SignalTimeline
        articles={[article({ articleId: "s1" })]}
        copy={copy}
      />,
    );
    const lead = container.querySelector("[data-signal-lead]")!;
    expect(lead.querySelector("img")).toBeNull();
    const band = lead.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(band).not.toBeNull();
    expect(band.style.background).toContain("linear-gradient");
  });
});
