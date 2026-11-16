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

import { FamilyBadge } from "@/components/articles/FamilyBadge";
import { ArticleCardSmall } from "@/components/home/ArticleCardSmall";
import { ArticleRow } from "@/components/home/ArticleRow";
import { ArticleThumbRow } from "@/components/home/ArticleThumbRow";
import { LeadArticleCard } from "@/components/home/LeadArticleCard";
import { MobileLeadCard } from "@/components/home/MobileMorningCards";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import type { ArticleMeta } from "@/lib/articles/article-model";
import type { HomeCopy } from "@/lib/home/home-copy";

/**
 * 題から種類のラベルを外しても、題を出す所では種類が分かるように、
 * family のバッジに印 (今のラベルの絵文字) を付ける (2026-11-16 設計 §5)。
 */
describe("FamilyBadge", () => {
  it("shows the mark before the family name", () => {
    const { container } = render(<FamilyBadge family="signal" label="Signal" />);
    const badge = container.querySelector("[data-family-badge]")!;
    expect(badge).toHaveTextContent("📡 Signal");
    expect(badge).toHaveAttribute("data-family-badge", "signal");
  });

  it("hides the mark from screen readers (the name is read once)", () => {
    const { container } = render(<FamilyBadge family="deep-dive" label="Deep Dive" />);
    const mark = container.querySelector("[data-family-mark]")!;
    expect(mark).toHaveTextContent("🔬");
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });

  it("shows only the name for a family without a mark", () => {
    const { container } = render(<FamilyBadge family="session" label="セッション記事" />);
    expect(container.querySelector("[data-family-badge]")!.textContent).toBe("セッション記事");
    expect(container.querySelector("[data-family-mark]")).toBeNull();
  });

  it("is a plain span without href", () => {
    const { container } = render(<FamilyBadge family="signal" label="Signal" />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[data-family-badge]")!.tagName).toBe("SPAN");
  });

  it("is a link when given an href", () => {
    const { container } = render(
      <FamilyBadge family="signal" label="Signal" href="/articles/series/signal" />,
    );
    const link = container.querySelector("a")!;
    expect(link).toHaveAttribute("href", "/articles/series/signal");
    expect(link).toHaveAttribute("data-family-badge", "signal");
    expect(link).toHaveTextContent("📡 Signal");
  });
});

const article: ArticleMeta = {
  articleId: "signal-20261110-40bd8a79",
  family: "signal",
  titleJa: "Claude Fable 5.2、Opus 5.5 並みの成績を半分の費用で",
  publishedAtJst: "2026-11-10T18:00:00+09:00",
  publishedLabel: "11-10 18:00 公開",
  lanes: [],
  href: "/articles/signal-20261110-40bd8a79",
};

const dailyIntel: ArticleMeta = {
  ...article,
  articleId: "daily-intel-20261110-abc12345",
  family: "daily-intel",
  href: "/articles/daily-intel-20261110-abc12345",
};

/** カードはカード全体がリンク。バッジはリンクにしない (a の入れ子を作らない) */
function expectBadgeInsideSingleCardLink(container: HTMLElement, text: string) {
  const links = container.querySelectorAll("a");
  expect(links).toHaveLength(1);
  const badge = links[0].querySelector("[data-family-badge]")!;
  expect(badge).not.toBeNull();
  expect(badge.tagName).toBe("SPAN");
  expect(badge).toHaveTextContent(text);
}

describe("card badges carry the mark and are never links", () => {
  it("ArticleCardSmall", () => {
    const { container } = render(<ArticleCardSmall article={article} familyLabel="Signal" />);
    expectBadgeInsideSingleCardLink(container, "📡 Signal");
  });

  it("ArticleRow", () => {
    const { container } = render(<ArticleRow article={article} familyLabel="Signal" />);
    expectBadgeInsideSingleCardLink(container, "📡 Signal");
    // 安全ゲートが頼る目印は残す
    expect(container.querySelector('[data-testid="article-row-chip"]')).toHaveTextContent(
      "📡 Signal",
    );
  });

  it("ArticleThumbRow", () => {
    const { container } = render(<ArticleThumbRow article={article} familyLabel="Signal" />);
    expectBadgeInsideSingleCardLink(container, "📡 Signal");
  });

  it("SearchResultRow", () => {
    const { container } = render(
      <SearchResultRow article={article} familyLabel="Signal" terms={[]} />,
    );
    expectBadgeInsideSingleCardLink(container, "📡 Signal");
  });

  it("LeadArticleCard (full)", () => {
    const { container } = render(
      <LeadArticleCard
        slot={{ state: "today", article: dailyIntel, previous: null }}
        labels={{ pending: "", pendingNote: "", previous: "", family: "Daily Intel" }}
      />,
    );
    expectBadgeInsideSingleCardLink(container, "📋 Daily Intel");
  });

  it("MobileLeadCard", () => {
    const copy = { hero: { leadFamily: "Daily Intel" } } as unknown as Pick<
      HomeCopy,
      "hero" | "mkt12" | "familyLabels"
    >;
    const { container } = render(
      <MobileLeadCard lead={{ state: "today", article: dailyIntel, previous: null }} copy={copy} />,
    );
    expectBadgeInsideSingleCardLink(container, "📋 Daily Intel");
  });
});
