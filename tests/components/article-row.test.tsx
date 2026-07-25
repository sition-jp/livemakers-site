/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

import { ArticleRow } from "@/components/home/ArticleRow";
import type { ArticleMeta } from "@/lib/articles/article-model";

const article: ArticleMeta = {
  articleId: "daily-intel-2026-05-16",
  family: "daily-intel",
  titleJa:
    "CLARITY Act 上院銀行委員会 15-9 で本会議入り — 2 民主党賛成・Coinbase/Chainlink/Grayscale 一斉歓迎",
  publishedAtJst: "2026-05-16T07:30:00+09:00",
  publishedLabel: "05-16 07:30 公開",
  lanes: ["macro"],
  href: "/ja/articles/daily-intel-2026-05-16",
};

describe("G48 D4: ArticleRow layout B", () => {
  it("puts the title first, ahead of the chip and the date", () => {
    const { container } = render(
      <ArticleRow article={article} familyLabel="Daily Intel" />,
    );
    const row = container.querySelector("a")!;
    const title = row.querySelector('[data-testid="article-row-title"]')!;
    const chip = row.querySelector('[data-testid="article-row-chip"]')!;

    expect(row.firstElementChild).toBe(title);
    // タイトルはチップより前 (DOCUMENT_POSITION_FOLLOWING = 4)
    expect(title.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it("no longer constrains the title to a middle grid column", () => {
    const { container } = render(
      <ArticleRow article={article} familyLabel="Daily Intel" />,
    );
    expect(container.querySelector("a")!.className).not.toContain(
      "grid-cols-[auto_1fr_auto]",
    );
  });

  it("keeps the contract attributes the safety gates rely on", () => {
    const { container } = render(
      <ArticleRow article={article} familyLabel="Daily Intel" indexNav />,
    );
    const row = container.querySelector("a")!;
    expect(row.getAttribute("data-article-id")).toBe("daily-intel-2026-05-16");
    expect(row.getAttribute("href")).toBe("/ja/articles/daily-intel-2026-05-16");
    expect(row.hasAttribute("data-index-nav")).toBe(true);
  });

  it("omits data-index-nav when the surface is not an index", () => {
    const { container } = render(
      <ArticleRow article={article} familyLabel="Daily Intel" />,
    );
    expect(container.querySelector("a")!.hasAttribute("data-index-nav")).toBe(false);
  });

  it("still renders lane tags when laneLabels are supplied", () => {
    const { getByText } = render(
      <ArticleRow
        article={article}
        familyLabel="Daily Intel"
        laneLabels={{ macro: "マクロ", crypto: "クリプト", rwa: "RWA" }}
      />,
    );
    expect(getByText("マクロ")).toBeTruthy();
  });
});
