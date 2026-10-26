/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CompositeHero } from "@/components/home/CompositeHero";
import { SessionLine } from "@/components/home/SessionLine";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import type { SessionRecord } from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";

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

// 2026-10-26 田平氏 GO: セッション 1 行は hero から Intelligence Terminal の見出しの
// 下 (leading の session-line) へ移した。中身・リンク先の規則は hero 時代と同じ。
describe("mobile session line (G44 D8 single representation)", () => {
  // D6 (crystallize 前の 404 回避, G43-e / fix round 2 I-2): the fixture's
  // live session is articleStatus=pending but repo-origin — getAllSessionRecords()
  // (the real generateStaticParams source) already crystallized it on disk, so
  // it IS materialized and the CTA must route to currentUrl, not the archive
  // chrome route. Materialization, not articleStatus, is what avoids 404s.
  it("routes to currentUrl for a repo-origin pending live session (D6 fix round 2 / I-2, ②)", () => {
    expect(props.live).not.toBeNull();
    expect(props.live!.articleStatus).toBe("pending");
    expect(props.live!.hasMaterializedRoute).not.toBe(false);
    const { container } = render(
      <SessionLine live={props.live} copy={copy.hero} />,
    );
    const line = container;
    const link = line.querySelector("a")!;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe(props.live!.currentUrl);
    expect(link.hasAttribute("data-index-nav")).toBe(true);
    expect(link.textContent).toContain(
      getSessionBySlug(props.live!.sessionSlug).nameJa,
    );
    expect(link.textContent).toContain(props.live!.asOfJst.slice(11, 16));
  });

  it("routes to currentUrl once the live session is published (D6, ③)", () => {
    expect(props.live).not.toBeNull();
    const publishedLive: SessionRecord = {
      ...props.live!,
      liveStatus: "closed",
      articleStatus: "published",
      canonicalArticleUrl: props.live!.currentUrl,
      publishedAt: "2026-07-10T06:00:00+09:00",
    };
    const { container } = render(
      <SessionLine live={publishedLive} copy={copy.hero} />,
    );
    const line = container;
    const link = line.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(publishedLive.currentUrl);
  });

  // 2026-08-23 (田平氏 GO): the D6 archive detour is retired here too, same as
  // SessionNowCard — app/[locale]/sessions/[slug] resolves feed-origin records
  // at their own URL (resolveSessionPageRecord), so a feed-lifted record never
  // 404s while it is in the feed, and the archive detour landed readers on a
  // stale list.
  it("routes to currentUrl even when the live session is feed-origin and not yet materialized (D6 detour retired 2026-08-23)", () => {
    expect(props.live).not.toBeNull();
    const feedOnlyLive: SessionRecord = {
      ...props.live!,
      hasMaterializedRoute: false,
    };
    const { container } = render(
      <SessionLine live={feedOnlyLive} copy={copy.hero} />,
    );
    const line = container;
    const link = line.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(feedOnlyLive.currentUrl);
  });

  // 2026-08-23 田平氏 GO (spec §A): live が無い窓は直前に終わったセッションを
  // 「直前のセッション … 終了」として見せる (mobile の唯一の表現)。
  it("shows the most recent closed session with the ended marker when no session is live", () => {
    const closed: SessionRecord = {
      ...props.live!,
      liveStatus: "closed",
      asOfJst: "2026-07-10T07:30:00+09:00",
      hasMaterializedRoute: false,
    };
    const { container } = render(
      <SessionLine live={null} recentClosed={closed} copy={copy.hero} />,
    );
    const line = container;
    const link = line.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(closed.currentUrl);
    expect(link.getAttribute("data-session-state")).toBe("closed");
    expect(line.textContent).toContain("直前のセッション");
    expect(line.textContent).toContain(
      getSessionBySlug(closed.sessionSlug).nameJa,
    );
    expect(line.textContent).toContain("07:30 JST · 終了");
    expect(line.textContent).not.toContain("切替中");
  });

  it("keeps the same editorial URL on English while hiding Japanese editorial", () => {
    expect(props.live).not.toBeNull();
    const feedEditorialLive: SessionRecord = {
      ...props.live!,
      hasMaterializedRoute: false,
      editorial: {
        digestId: "dig_20260710_0712_ab12cd34",
        crawlAnchorJst: "2026-07-10T05:03:00+09:00",
        writtenAtJst: "2026-07-10T07:12:00+09:00",
        lead: "日本語の editorial は英語面に表示しない。",
        items: [{
          headline: "公式発表で変更が示された",
          sourceUrl: "https://primary.example.org/news/123",
        }],
        watch: ["次の公式発表を確認する。"],
      },
    };
    const { container } = render(
      <SessionLine
        live={feedEditorialLive}
        copy={copy.hero}
        showSessionEditorial={false}
      />,
    );
    const line = container;
    expect(line.querySelector("a")?.getAttribute("href")).toBe(
      feedEditorialLive.currentUrl,
    );
    expect(line.textContent).not.toContain(feedEditorialLive.editorial!.lead);
  });

  it("falls back to the session archive link when no session is live", () => {
    const { container } = render(
      <SessionLine live={null} copy={copy.hero} />,
    );
    const line = container;
    const link = line.querySelector("a")!;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/sessions/archive");
  });

});

// 2026-08-23 田平氏 GO (spec 2026-08-23-digest-only-session-design §5): mobile
// hero も「読み解きのみ」を時刻の後ろに付ける。
describe("mobile session line digest-only session (observationStatus=absent)", () => {
  it("appends the digest-only marker to the time span", () => {
    const digestLive: SessionRecord = {
      ...props.live!,
      asOfJst: "2026-07-10T07:12:00+09:00",
      observationStatus: "absent",
      editorial: {
        digestId: "dig_20260710_0712_ab12cd34",
        crawlAnchorJst: "2026-07-10T05:03:00+09:00",
        writtenAtJst: "2026-07-10T07:12:00+09:00",
        lead: "市場は方向感を探っている。",
        items: [{ headline: "公式発表で変更が示された", sourceUrl: "https://primary.example.org/news/123" }],
        watch: ["次の公式発表を確認する。"],
      },
    };
    const { container } = render(
      <SessionLine live={digestLive} copy={copy.hero} />,
    );
    const line = container;
    expect(line.textContent).toContain("07:12 JST · 読み解きのみ");
  });
});

// 2026-10-26 田平氏 GO: スマホ上部 = Daily Intel 大カード (サムネ付き) + 今朝の12指標
// 小カード (小サムネの行・アーカイブリンクは下)。PC の Daily Intel 欄・今朝の12指標欄
// はスマホで非表示 (同じ記事を 2 回出さない)。hero は索引扱いで data-article-id を持たない。
describe("composite hero (mobile Daily Intel + 12 indicators cards)", () => {
  function renderHero(overrides: Partial<{ lead: HomeSlots["lead"]; mkt12: HomeSlots["mkt12"] }> = {}) {
    return render(
      <CompositeHero
        lead={overrides.lead ?? props.slots.lead}
        mkt12={overrides.mkt12 ?? props.slots.mkt12}
        copy={copy}
      />,
    );
  }

  it("renders the Daily Intel lead as a large thumbnail card", () => {
    expect(props.slots.lead.article).not.toBeNull();
    const { container } = renderHero();
    const card = container.querySelector('[data-column-module="hero-lead-card"]')!;
    const link = card.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(props.slots.lead.article!.href);
    expect(link.hasAttribute("data-index-nav")).toBe(true);
    expect(link.querySelector("[data-article-thumbnail]")).not.toBeNull();
    expect(link.textContent).toContain(props.slots.lead.article!.titleJa);
    expect(link.textContent).toContain(copy.hero.leadFamily);
  });

  it("shows the static pending copy without a link when the lead is pending", () => {
    const { container } = renderHero({ lead: pendingLead });
    const card = container.querySelector('[data-column-module="hero-lead-card"]')!;
    expect(card.querySelectorAll("a")).toHaveLength(0);
    expect(card.textContent).toContain("本日の記事は準備中");
  });

  it("renders this morning's 12 indicators as a small card with the archive link below", () => {
    expect(props.slots.mkt12.article).not.toBeNull();
    const { container } = renderHero();
    const card = container.querySelector('[data-column-module="hero-mkt12-card"]')!;
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
    const { container } = renderHero({ mkt12: weekend });
    const card = container.querySelector('[data-column-module="hero-mkt12-card"]')!;
    expect(card.querySelector("h3")?.textContent).toBe(copy.mkt12.articleTitleWeekend);
    expect(card.textContent).toContain(copy.mkt12.awaitingWeekend);
    expect(card.querySelector('a[href="/articles/series/mkt12-weekend"]')).not.toBeNull();
  });

  it("never renders data-article-id anywhere in the hero", () => {
    for (const lead of [props.slots.lead, pendingLead]) {
      const { container } = renderHero({ lead });
      expect(container.querySelectorAll("[data-article-id]")).toHaveLength(0);
    }
  });
});
