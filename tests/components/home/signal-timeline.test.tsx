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
  freshness: buildTestHomeCopy().gradient.signalFreshness,
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

  it("links to the signal series index in the header, before the first row (2026-08-23 GO B-1)", () => {
    const { container } = render(
      <SignalTimeline articles={[article({ articleId: "s1" })]} copy={copy} />,
    );
    const link = container.querySelector('a[href="/articles/series/signal"]')!;
    expect(link).not.toBeNull();
    expect(link.closest("[data-index-nav]")).not.toBeNull();
    const firstRow = container.querySelector("a[data-article-id]")!;
    expect(
      link.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows today's count and the latest stamp next to the title", () => {
    const { container } = render(
      <SignalTimeline articles={[article({ articleId: "s1" })]} copy={copy} />,
    );
    expect(
      container.querySelector('[data-signal-freshness="today"]')?.textContent,
    ).toContain("今日 2 本");
    expect(
      container.querySelector('[data-signal-freshness="latest"]')?.textContent,
    ).toContain("最新 07-10 08:30");
  });

  it("omits freshness segments that are null (honest empty)", () => {
    const { container } = render(
      <SignalTimeline
        articles={[article({ articleId: "s1" })]}
        copy={{ ...copy, freshness: { todayCount: null, latestAt: "最新 07-09 22:10" } }}
      />,
    );
    expect(container.querySelector('[data-signal-freshness="today"]')).toBeNull();
    expect(
      container.querySelector('[data-signal-freshness="latest"]')?.textContent,
    ).toContain("最新 07-09 22:10");
    expect(container.textContent).not.toContain("今日 0 本");
  });
});
