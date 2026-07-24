/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
