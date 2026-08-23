/* @vitest-environment jsdom */
import path from "node:path";

import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CoincidentColumn } from "@/components/home/columns/CoincidentColumn";
import { LaggingColumn } from "@/components/home/columns/LaggingColumn";
import { LeadingColumn } from "@/components/home/columns/LeadingColumn";
import { REGION_MODULES } from "@/lib/home/gradient-ledger";
import {
  orderLaggingModules,
  laggingModuleLatest,
} from "@/lib/home/lagging-order";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
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

const props = buildHomeCompositionProps({
  today: "2026-07-10",
  articleCutoffToday: "2026-07-10",
  contentDir: path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "content",
    "articles",
  ),
});
const copy = buildTestHomeCopy();

function renderLeading() {
  return render(
    <LeadingColumn
      live={props.live}
      schedule={props.schedule}
      slots={props.slots}
      focusSeries={props.focusSeries}
      focusSessionSlug={props.focusSessionSlug}
      sessionProvenance={props.sessionProvenance}
      copy={copy}
    />,
  );
}

describe("LeadingColumn (gradient leading, D5)", () => {
  it("labels the lane Intelligence Terminal without renaming the four sessions", () => {
    renderLeading();
    expect(
      screen.getByRole("heading", { name: "Intelligence Terminal" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Asia Open Terminal").length).toBeGreaterThan(0);
  });

  it("shows an honest session fallback with the next update line when degraded (P0-1b)", () => {
    const degraded = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-08-07",
      contentDir: path.join(
        process.cwd(),
        "tests",
        "fixtures",
        "content",
        "articles",
      ),
    });
    expect(degraded.live).toBeNull();
    const { getByText } = render(
      <LeadingColumn
        live={degraded.live}
        schedule={degraded.schedule}
        slots={degraded.slots}
        focusSeries={degraded.focusSeries}
        focusSessionSlug={degraded.focusSessionSlug}
        sessionProvenance={degraded.sessionProvenance}
        copy={copy}
      />,
    );
    getByText("現在のセッションは切替中です");
    getByText("次の更新: Europe Bridge Terminal 12:03 JST");
  });

  it("renders modules in the ledger order", () => {
    const { container } = renderLeading();
    expect(
      [...container.querySelectorAll("[data-column-module]")].map((el) =>
        el.getAttribute("data-column-module"),
      ),
    ).toEqual([...REGION_MODULES.leading]);
  });

  it("splits event-risk (latest article) and radar-observations (title-only) into two modules (Phase 3)", () => {
    const { container } = renderLeading();
    // event-risk = 最新記事 1 本のみ (schedule 直下)
    const eventRisk = container.querySelector(
      '[data-column-module="event-risk"]',
    )!;
    expect(eventRisk.querySelector("[data-radar]")).toBeNull();
    const links = eventRisk.querySelectorAll("a[data-article-id]");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("data-article-id")).toBe(
      "event-risk-radar-w29",
    );
    // radar-observations = 観測 title-only (リンクなし・flash-promotion 直下)
    const observations = container.querySelector(
      '[data-column-module="radar-observations"]',
    )!;
    expect(observations.querySelector("[data-radar]")).not.toBeNull();
    expect(observations.querySelectorAll("a")).toHaveLength(0);
  });

  it("shows the flash-promotion empty state when no pair exists (RADAR_PROMOTIONS empty)", () => {
    const { container } = renderLeading();
    const flash = container.querySelector(
      '[data-column-module="flash-promotion"]',
    )!;
    // empty state: no article link, no data-article-id
    expect(flash.querySelectorAll("a")).toHaveLength(0);
    expect(flash.querySelector("[data-article-id]")).toBeNull();
  });
});

describe("CoincidentColumn (gradient coincident, D6)", () => {
  function renderCoincident() {
    return render(
      <CoincidentColumn
        slots={props.slots}
        snapshot={props.snapshot}
        coreCells={props.coreCells}
        laneCells={props.laneCells}
        laneProvenance={props.laneProvenance}
        mkt12Provenance={props.mkt12Provenance}
        copy={copy}
      />,
    );
  }

  it("renders modules in the ledger order", () => {
    const { container } = renderCoincident();
    expect(
      [...container.querySelectorAll("[data-column-module]")].map((el) =>
        el.getAttribute("data-column-module"),
      ),
    ).toEqual([...REGION_MODULES.coincident]);
  });

  // 2026-08-23 田平氏 GO B-1: 「Daily Intel」帯 = compact Daily Intel + サムネなし 12指標行
  it("renders the morning desk as one band: Daily Intel header, compact lead, thumb-less mkt12 row", () => {
    const { container } = renderCoincident();
    const desk = container.querySelector(
      '[data-column-module="morning-desk"] [data-morning-desk]',
    )!;
    expect(desk).not.toBeNull();
    // ヘッダ = 「Daily Intel」(h3 は帯に 1 つだけ)
    expect(desk.querySelectorAll("h3")).toHaveLength(1);
    expect(desk.querySelector("h3")?.textContent).toBe(copy.familyLabels["daily-intel"]);
    // 本体 2 本 (Daily Intel + 12指標)・抜粋なし
    const bodies = desk.querySelectorAll("a[data-article-id]");
    expect([...bodies].map((a) => a.getAttribute("data-article-id"))).toEqual([
      "daily-intel-2026-07-10",
      "mkt12-morning-2026-07-10",
    ]);
    expect(desk.textContent).not.toContain(props.slots.lead.article!.excerptJa!);
    // サムネは Daily Intel の 1 枚だけ (12指標行はサムネなし)
    expect(desk.querySelectorAll("[data-article-thumbnail]")).toHaveLength(1);
    expect(desk.querySelectorAll("img").length).toBeLessThanOrEqual(1);
    // Daily Intel ブロックだけ <xl hidden (D8)
    const lead = desk.querySelector('[data-morning-desk-role="daily-intel"]')!;
    expect(lead.classList.contains("hidden")).toBe(true);
    expect(lead.classList.contains("xl:block")).toBe(true);
    expect(lead.querySelector('[data-lead-variant="compact"]')).not.toBeNull();
    // compact カードに family ラベル行は無い (帯ヘッダが担う)
    expect(
      [...lead.querySelectorAll("span")].some((span) => span.textContent === copy.lead.family),
    ).toBe(false);
    // 索引リンク: Daily Intel 一覧はヘッダ・12指標アーカイブは行の右隣
    const intelLink = desk.querySelector('a[href="/articles/series/daily-intel"]')!;
    expect(intelLink.closest("[data-index-nav]")).not.toBeNull();
    const mkt12Link = desk.querySelector(
      '[data-mkt12-role="archive-link"] a[href="/articles/series/mkt12-morning"]',
    )!;
    expect(mkt12Link.closest("[data-index-nav]")).not.toBeNull();
    expect(
      intelLink.compareDocumentPosition(lead) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the mkt12 row thumb-less and labelled by its family chip", () => {
    const { container } = renderCoincident();
    const row = container.querySelector('[data-mkt12-reading] [data-mkt12-role="hero"] a[data-article-id]')!;
    expect(row.getAttribute("data-article-id")).toBe("mkt12-morning-2026-07-10");
    expect(row.querySelector("img")).toBeNull();
    expect(row.querySelector('[data-testid="article-row-chip"]')?.textContent).toBe(
      copy.familyLabels["mkt12-morning"],
    );
  });

  it("puts the signal timeline right after the morning desk", () => {
    const { container } = renderCoincident();
    const modules = [...container.querySelectorAll("[data-column-module]")].map((el) =>
      el.getAttribute("data-column-module"),
    );
    expect(modules.slice(0, 2)).toEqual(["morning-desk", "signal-timeline"]);
  });

  it("renders the signal timeline with at least the floor of ten rows", () => {
    const { container } = renderCoincident();
    const timeline = container.querySelector(
      '[data-column-module="signal-timeline"]',
    )!;
    expect(
      timeline.querySelectorAll("a[data-article-id]").length,
    ).toBeGreaterThanOrEqual(10);
  });

  it("shows lane values with per-lane anchors and no article links", () => {
    const { container } = renderCoincident();
    const laneValues = container.querySelector(
      '[data-column-module="lane-values"]',
    )!;
    expect(laneValues.querySelectorAll("a")).toHaveLength(0);
    expect(
      [...laneValues.querySelectorAll("[data-lane]")].map((el) =>
        el.getAttribute("data-lane"),
      ),
    ).toEqual(["macro", "crypto", "rwa"]);
  });

  it("does not render the retired pair-section joint glyph", () => {
    const { container } = renderCoincident();
    expect(container.textContent).not.toContain("⇄");
  });
});

describe("LaggingColumn (gradient lagging, D7)", () => {
  function renderLagging(surfacePublished = false) {
    return render(
      <LaggingColumn
        slots={props.slots}
        surfacePublished={surfacePublished}
        copy={copy}
      />,
    );
  }

  it("renders the four article modules newest-first, then the fixed ledger tail (2026-08-23 田平氏 GO A)", () => {
    const { container } = renderLagging();
    const rendered = [
      ...container.querySelectorAll("[data-column-module]"),
    ].map((el) => el.getAttribute("data-column-module"));
    expect(rendered).toEqual(orderLaggingModules(props.slots));
    // permutation of the ledger — nothing added, nothing dropped
    expect([...rendered].sort()).toEqual([...REGION_MODULES.lagging].sort());
    expect(rendered.slice(-2)).toEqual([
      "latest-articles",
      "turning-point-reserved",
    ]);
    // the article block really is in publishedAtJst descending order
    const stamps = rendered
      .slice(0, 4)
      .map(
        (module) =>
          laggingModuleLatest(
            props.slots,
            module as "deep-dive" | "atlas-entry" | "mkt12-weekend" | "weekly-brief",
          )?.publishedAtJst ?? "",
      )
      .filter((stamp) => stamp !== "");
    expect(stamps).toEqual([...stamps].sort().reverse());
    expect(
      container
        .querySelector('[data-ledger-group="lagging"]')!
        .getAttribute("data-lagging-order"),
    ).toBe("newest-first");
  });

  it("moves a module to the top when its latest article is the newest", () => {
    const newest = {
      ...props.slots.latestArticles[0]!,
      articleId: "weekly-brief-newest",
      family: "weekly-brief" as const,
      publishedAtJst: "2026-07-10T23:00:00+09:00",
      href: "/articles/weekly-brief-newest",
    };
    const { container } = render(
      <LaggingColumn
        slots={{ ...props.slots, weeklyBriefLatest: newest }}
        surfacePublished={false}
        copy={copy}
      />,
    );
    const rendered = [
      ...container.querySelectorAll("[data-column-module]"),
    ].map((el) => el.getAttribute("data-column-module"));
    expect(rendered[0]).toBe("weekly-brief");
    expect(rendered.slice(-2)).toEqual([
      "latest-articles",
      "turning-point-reserved",
    ]);
  });

  it("treats only the deep-dive featured article as body content", () => {
    const { container } = renderLagging();
    const deepDive = container.querySelector(
      '[data-column-module="deep-dive"]',
    )!;
    const bodyLinks = [
      ...deepDive.querySelectorAll("a[data-article-id]"),
    ].filter((a) => a.closest("[data-index-nav]") === null);
    expect(bodyLinks).toHaveLength(1);
  });

  it("keeps every link in the index modules under data-index-nav", () => {
    const { container } = renderLagging();
    for (const module of [
      "atlas-entry",
      "mkt12-weekend",
      "weekly-brief",
      "latest-articles",
    ]) {
      const el = container.querySelector(`[data-column-module="${module}"]`)!;
      for (const anchor of el.querySelectorAll("a")) {
        expect(anchor.closest("[data-index-nav]")).not.toBeNull();
      }
    }
  });

  it("points the atlas entry at the future-map series while unpublished", () => {
    const { container } = renderLagging(false);
    const atlas = container.querySelector(
      '[data-column-module="atlas-entry"]',
    )!;
    expect(
      atlas.querySelector('a[href="/articles/series/future-map"]'),
    ).not.toBeNull();
  });

  it("switches the atlas entry to /future-atlas when published", () => {
    const { container } = renderLagging(true);
    const atlas = container.querySelector(
      '[data-column-module="atlas-entry"]',
    )!;
    expect(atlas.querySelector('a[href="/future-atlas"]')).not.toBeNull();
  });

  it("renders latest-articles as twenty index-nav rows (2026-08-14 田平氏指示)", () => {
    const { container } = renderLagging();
    const latest = container.querySelector(
      '[data-column-module="latest-articles"]',
    )!;
    expect(latest.querySelectorAll("a[data-article-id]")).toHaveLength(20);
  });
});
