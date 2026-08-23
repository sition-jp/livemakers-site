/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CompositeHero } from "@/components/home/CompositeHero";
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

describe("composite hero (mobile single representation, G44 D8)", () => {
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
      <CompositeHero live={props.live} lead={props.slots.lead} copy={copy.hero} />,
    );
    const line = container.querySelector(
      '[data-column-module="hero-session-line"]',
    )!;
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
      <CompositeHero live={publishedLive} lead={props.slots.lead} copy={copy.hero} />,
    );
    const line = container.querySelector(
      '[data-column-module="hero-session-line"]',
    )!;
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
      <CompositeHero live={feedOnlyLive} lead={props.slots.lead} copy={copy.hero} />,
    );
    const line = container.querySelector(
      '[data-column-module="hero-session-line"]',
    )!;
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
      <CompositeHero
        live={null}
        recentClosed={closed}
        lead={pendingLead}
        copy={copy.hero}
      />,
    );
    const line = container.querySelector(
      '[data-column-module="hero-session-line"]',
    )!;
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
      <CompositeHero
        live={feedEditorialLive}
        lead={props.slots.lead}
        copy={copy.hero}
        showSessionEditorial={false}
      />,
    );
    const line = container.querySelector(
      '[data-column-module="hero-session-line"]',
    )!;
    expect(line.querySelector("a")?.getAttribute("href")).toBe(
      feedEditorialLive.currentUrl,
    );
    expect(line.textContent).not.toContain(feedEditorialLive.editorial!.lead);
  });

  it("falls back to the session archive link when no session is live", () => {
    const { container } = render(
      <CompositeHero live={null} lead={pendingLead} copy={copy.hero} />,
    );
    const line = container.querySelector(
      '[data-column-module="hero-session-line"]',
    )!;
    const link = line.querySelector("a")!;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/sessions/archive");
  });

  it("links the Daily Intel headline when a lead article is present", () => {
    expect(props.slots.lead.article).not.toBeNull();
    const { container } = render(
      <CompositeHero live={props.live} lead={props.slots.lead} copy={copy.hero} />,
    );
    const headline = container.querySelector(
      '[data-column-module="hero-lead-headline"]',
    )!;
    const link = headline.querySelector("a")!;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe(props.slots.lead.article!.href);
    expect(link.hasAttribute("data-index-nav")).toBe(true);
    expect(link.textContent).toContain(props.slots.lead.article!.titleJa);
  });

  it("shows the static pending copy without a link when the lead is pending", () => {
    const { container } = render(
      <CompositeHero live={props.live} lead={pendingLead} copy={copy.hero} />,
    );
    const headline = container.querySelector(
      '[data-column-module="hero-lead-headline"]',
    )!;
    expect(headline.querySelectorAll("a")).toHaveLength(0);
    expect(headline.textContent).toContain("本日の記事は準備中");
  });

  it("never renders data-article-id anywhere in the hero", () => {
    for (const lead of [props.slots.lead, pendingLead]) {
      const { container } = render(
        <CompositeHero live={props.live} lead={lead} copy={copy.hero} />,
      );
      expect(container.querySelectorAll("[data-article-id]")).toHaveLength(0);
    }
  });
});
