/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { FundingShelf } from "@/components/home/FundingShelf";
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

const mk = (id: string): ArticleMeta => ({
  articleId: id,
  family: "signal",
  titleJa: id,
  publishedAtJst: "2026-10-27T21:30:00+09:00",
  publishedLabel: "10-27 21:30 公開",
  lanes: [],
  href: `/articles/${id}`,
});
const homeCopy = buildTestHomeCopy();
const copy = {
  title: homeCopy.gradient.fundingTitle,
  viewAll: homeCopy.gradient.fundingViewAll,
  familyLabels: homeCopy.familyLabels,
};

describe("FundingShelf", () => {
  it("renders up to 5 index rows and the view-all link, no featured card", () => {
    const articles = ["f0", "f1", "f2", "f3", "f4", "f5", "f6"].map(mk);
    const { container } = render(<FundingShelf articles={articles} copy={copy} />);
    const rows = container.querySelectorAll("a[data-article-id]");
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.hasAttribute("data-index-nav")).toBe(true);
      expect(row.hasAttribute("data-thumb-row")).toBe(true);
    }
    // 大きなカード (ArticleCardSmall) は置かない
    expect(container.querySelector("article")).toBeNull();
    expect(container.querySelector("h3")?.textContent).toBe("資金調達");
    const link = container.querySelector('a[href="/topics/funding"]');
    expect(link?.textContent).toBe("資金調達の記事をすべて見る →");
    expect(link?.closest("[data-index-nav]")).not.toBeNull();
  });
});
