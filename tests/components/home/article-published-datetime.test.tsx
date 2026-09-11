/* @vitest-environment jsdom */
import path from "node:path";

import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ArticleCardSmall } from "@/components/home/ArticleCardSmall";
import { ArticleRow } from "@/components/home/ArticleRow";
import { ArticleThumbRow } from "@/components/home/ArticleThumbRow";
import { LeadArticleCard } from "@/components/home/LeadArticleCard";
import { getArticleBySlug } from "@/lib/articles/article-model";

/**
 * G3 (2026-09-11 田平氏 GO): カード群の可視ラベルは短い `MM-DD HH:MM 公開`
 * のまま (幅制約があるため touch しない — 記事詳細ページだけ年を足す)。
 * だが機械可読の `dateTime` はどのカードにも付ける。
 */
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

const article = getArticleBySlug("signal-dxy-plateau-2026-07-09", {
  contentDir: path.join(process.cwd(), "tests", "fixtures", "content", "articles"),
});

describe("article card <time dateTime> (G3)", () => {
  it("ArticleRow keeps the short label but adds dateTime", () => {
    render(<ArticleRow article={article} familyLabel="Signal" />);
    const time = screen.getByText(/07-09 16:40 公開/);
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("dateTime", article.publishedAtJst);
  });

  it("ArticleThumbRow keeps the short label but adds dateTime", () => {
    render(<ArticleThumbRow article={article} familyLabel="Signal" />);
    const time = screen.getByText(/07-09 16:40 公開/);
    expect(time).toHaveAttribute("dateTime", article.publishedAtJst);
  });

  it("ArticleCardSmall keeps the short label but adds dateTime", () => {
    render(<ArticleCardSmall article={article} familyLabel="Signal" />);
    const time = screen.getByText(/07-09 16:40 公開/);
    expect(time).toHaveAttribute("dateTime", article.publishedAtJst);
  });

  it("LeadArticleCard keeps the short label but adds dateTime", () => {
    render(
      <LeadArticleCard
        slot={{ state: "today", article, previous: null }}
        labels={{ pending: "", pendingNote: "", previous: "", family: "Signal" }}
      />,
    );
    const time = screen.getByText(/07-09 16:40 公開/);
    expect(time).toHaveAttribute("dateTime", article.publishedAtJst);
  });
});
