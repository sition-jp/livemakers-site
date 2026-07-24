/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CoincidentColumn } from "@/components/home/columns/CoincidentColumn";
import { LaggingColumn } from "@/components/home/columns/LaggingColumn";
import { LeadingColumn } from "@/components/home/columns/LeadingColumn";
import { REGION_MODULES } from "@/lib/home/gradient-ledger";
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
  it("renders modules in the ledger order", () => {
    const { container } = renderLeading();
    expect(
      [...container.querySelectorAll("[data-column-module]")].map((el) =>
        el.getAttribute("data-column-module"),
      ),
    ).toEqual([...REGION_MODULES.leading]);
  });

  it("keeps event-risk observations title-only and links the latest event-risk article", () => {
    const { container } = renderLeading();
    const eventRisk = container.querySelector(
      '[data-column-module="event-risk"]',
    )!;
    // observations are title-only (no anchors inside data-radar)
    expect(eventRisk.querySelectorAll("[data-radar] a")).toHaveLength(0);
    // exactly one linked article — the latest event-risk-radar article
    const links = eventRisk.querySelectorAll("a[data-article-id]");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("data-article-id")).toBe(
      "event-risk-radar-w29",
    );
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

  it("renders modules in the ledger order", () => {
    const { container } = renderLagging();
    expect(
      [...container.querySelectorAll("[data-column-module]")].map((el) =>
        el.getAttribute("data-column-module"),
      ),
    ).toEqual([...REGION_MODULES.lagging]);
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

  it("renders latest-articles as ten index-nav rows", () => {
    const { container } = renderLagging();
    const latest = container.querySelector(
      '[data-column-module="latest-articles"]',
    )!;
    expect(latest.querySelectorAll("a[data-article-id]")).toHaveLength(10);
  });
});
