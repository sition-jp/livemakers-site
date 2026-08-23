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
