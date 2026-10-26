/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  MobileLeadCard,
  MobileMkt12Card,
} from "@/components/home/MobileMorningCards";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import type { HomeSlots } from "@/lib/home/select-home-slots";

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

const props = buildHomeCompositionProps({
  today: "2026-07-10",
  articleCutoffToday: "2026-07-10",
  contentDir: path.join(process.cwd(), "tests", "fixtures", "content", "articles"),
});
const copy = buildTestHomeCopy();
const pendingLead: HomeSlots["lead"] = {
  state: "pending",
  article: null,
  previous: null,
};

// 2026-10-26 田平氏 GO: スマホの Daily Intel 大カード (サムネ付き) + 今朝の12指標
// 小カード (小サムネの行・アーカイブリンクは行の下)。Intelligence Terminal の下に置き、
// PC の Daily Intel 欄・今朝の12指標欄はスマホで非表示 (同じ記事を 2 回出さない)。
// 索引扱いで data-article-id を持たない。
describe("mobile Daily Intel + 12 indicators cards", () => {
  const renderLead = (lead: HomeSlots["lead"] = props.slots.lead) =>
    render(<MobileLeadCard lead={lead} copy={copy} />);
  const renderMkt12 = (mkt12: HomeSlots["mkt12"] = props.slots.mkt12) =>
    render(<MobileMkt12Card mkt12={mkt12} copy={copy} />);

  it("renders the Daily Intel lead as a large thumbnail card", () => {
    expect(props.slots.lead.article).not.toBeNull();
    const { container: card } = renderLead();
    const link = card.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(props.slots.lead.article!.href);
    expect(link.hasAttribute("data-index-nav")).toBe(true);
    expect(link.querySelector("[data-article-thumbnail]")).not.toBeNull();
    expect(link.textContent).toContain(props.slots.lead.article!.titleJa);
    expect(link.textContent).toContain(copy.hero.leadFamily);
  });

  it("shows the static pending copy without a link when the lead is pending", () => {
    const { container: card } = renderLead(pendingLead);
    expect(card.querySelectorAll("a")).toHaveLength(0);
    expect(card.textContent).toContain("本日の記事は準備中");
  });

  it("renders this morning's 12 indicators as a small card with the archive link below", () => {
    expect(props.slots.mkt12.article).not.toBeNull();
    const { container: card } = renderMkt12();
    expect(card.querySelector("h3")?.textContent).toBe(copy.mkt12.articleTitle);
    const row = card.querySelector("a[data-thumb-row]")!;
    expect(row.getAttribute("href")).toBe(props.slots.mkt12.article!.href);
    expect(row.closest("[data-index-nav]")).not.toBeNull();
    const archive = card.querySelector('a[href="/articles/series/mkt12-morning"]')!;
    expect(archive.closest("[data-index-nav]")).not.toBeNull();
    expect(row.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 右隣に並べない (2026-10-26 のスマホ崩れの原因)
    expect(archive.parentElement!.classList.contains("text-right")).toBe(true);
    expect(archive.parentElement!.parentElement).toBe(card.querySelector("section"));
  });

  it("switches the 12 indicators card to the weekend wording and awaiting copy", () => {
    const weekend: HomeSlots["mkt12"] = {
      ...props.slots.mkt12,
      variant: "weekend",
      article: null,
    };
    const { container: card } = renderMkt12(weekend);
    expect(card.querySelector("h3")?.textContent).toBe(copy.mkt12.articleTitleWeekend);
    expect(card.textContent).toContain(copy.mkt12.awaitingWeekend);
    expect(card.querySelector('a[href="/articles/series/mkt12-weekend"]')).not.toBeNull();
  });

  it("never renders data-article-id in either card", () => {
    for (const lead of [props.slots.lead, pendingLead]) {
      const { container } = renderLead(lead);
      expect(container.querySelectorAll("[data-article-id]")).toHaveLength(0);
    }
    const { container } = renderMkt12();
    expect(container.querySelectorAll("[data-article-id]")).toHaveLength(0);
  });
});
