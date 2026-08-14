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
  seriesLink: buildTestHomeCopy().gradient.signalSeriesLink,
};

describe("SignalTimeline thumb rows (Phase 3b, 2026-08-14)", () => {
  it("renders a small thumbnail on every row", () => {
    const { container } = render(
      <SignalTimeline
        articles={[
          article({ articleId: "s1", thumbnailUrl: THUMB }),
          article({ articleId: "s2", titleJa: "📡 Signal｜2本目" }),
        ]}
        copy={copy}
      />,
    );
    const rows = container.querySelectorAll("a[data-article-id]");
    expect(rows).toHaveLength(2);
    const first = rows[0]!;
    expect(first.getAttribute("data-article-id")).toBe("s1");
    const img = first.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(THUMB);
    expect(img.className).toContain("object-cover");
    // サムネ未検証の行も枠を保つ (family 色の帯)
    const second = rows[1]!;
    expect(second.querySelector("img")).toBeNull();
    expect(
      second.querySelector('span[aria-hidden="true"]'),
    ).not.toBeNull();
    // Signal 行は本体扱い (index-nav にしない)
    expect(first.hasAttribute("data-index-nav")).toBe(false);
  });

  it("links to the signal series index at the bottom", () => {
    const { container } = render(
      <SignalTimeline articles={[article({ articleId: "s1" })]} copy={copy} />,
    );
    const link = container.querySelector(
      'a[href="/articles/series/signal"]',
    )!;
    expect(link).not.toBeNull();
    expect(link.closest("[data-index-nav]")).not.toBeNull();
  });
});
