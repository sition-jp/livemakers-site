/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { IndexEntryCard } from "@/components/home/IndexEntryCard";
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
  "https://example.public.blob.vercel-storage.com/livemakers/articles/wb-1/thumbnail.webp";

const mk = (overrides: Partial<ArticleMeta> = {}): ArticleMeta => ({
  articleId: "weekly-brief-1",
  family: "weekly-brief",
  titleJa: "LVM Weekly Brief #3",
  publishedAtJst: "2026-08-22T07:55:00+09:00",
  publishedLabel: "08-22 07:55 公開",
  lanes: [],
  href: "/articles/weekly-brief-1",
  ...overrides,
});

const copy = { familyLabels: buildTestHomeCopy().familyLabels };

function renderCard(latest: ArticleMeta | null) {
  return render(
    <IndexEntryCard
      heading="Weekly Brief"
      entryHref="/brief"
      entryLabel="一覧を見る"
      latest={latest}
      copy={copy}
    />,
  );
}

describe("IndexEntryCard", () => {
  it("renders the latest article with its 16:9 thumbnail like the Deep Dive featured card (2026-08-23 田平氏指示)", () => {
    const { container } = renderCard(mk({ thumbnailUrl: THUMB }));
    const link = container.querySelector(
      'a[data-article-id="weekly-brief-1"]',
    )!;
    expect(link).not.toBeNull();
    const frame = link.querySelector("[data-article-thumbnail]")!;
    expect(frame.getAttribute("data-article-thumbnail")).toBe("present");
    expect(frame.className).toContain("aspect-[16/9]");
    const img = frame.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(THUMB);
    expect(img.getAttribute("alt")).toBe("LVM Weekly Brief #3");
  });

  it("keeps a same-height family-colour placeholder frame when the thumbnail is absent (CLS zero)", () => {
    const { container } = renderCard(mk());
    const frame = container.querySelector("[data-article-thumbnail]")!;
    expect(frame.getAttribute("data-article-thumbnail")).toBe("placeholder");
    expect(frame.className).toContain("aspect-[16/9]");
    expect(container.querySelector("img")).toBeNull();
  });

  it("marks both the entry link and the latest article as index navigation (gate 6 / R3)", () => {
    const { container } = renderCard(mk({ thumbnailUrl: THUMB }));
    const anchors = [...container.querySelectorAll("a[href]")];
    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      expect(
        anchor.closest("[data-index-nav]"),
        `missing data-index-nav: ${anchor.getAttribute("href")}`,
      ).not.toBeNull();
    }
  });

  it("renders only the entry link when there is no latest article", () => {
    const { container } = renderCard(null);
    expect(container.querySelectorAll("a[href]")).toHaveLength(1);
    expect(container.querySelector("[data-article-thumbnail]")).toBeNull();
  });
});
