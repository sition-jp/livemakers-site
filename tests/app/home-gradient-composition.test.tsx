/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HomeComposition } from "@/components/home/HomeComposition";
import {
  buildHomeCompositionProps,
  resolveHomeRadarSource,
} from "@/lib/home/build-home-props";
import {
  GRADIENT_REGIONS,
  REGION_MODULES,
} from "@/lib/home/gradient-ledger";
import { orderLaggingModules } from "@/lib/home/lagging-order";
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

describe("gradient home composition (doctrine §4 gradient ledger, G44)", () => {
  const props = buildHomeCompositionProps({
    today: "2026-07-10",
    articleCutoffToday: "2026-07-10",
    contentDir: path.join(process.cwd(), "tests", "fixtures", "content", "articles"),
  });
  const copy = buildTestHomeCopy();

  const renderHome = () =>
    render(
      <HomeComposition {...props} surfacePublished={false} copy={copy} />,
    );

  it("renders the four regions in ledger DOM order", () => {
    const { container } = renderHome();
    const groups = [...container.querySelectorAll("[data-ledger-group]")].map(
      (element) => element.getAttribute("data-ledger-group"),
    );
    expect(groups).toEqual([...GRADIENT_REGIONS]);
  });

  it("exposes the server-selected article catalog source on the root", () => {
    const { container } = render(
      <HomeComposition
        {...props}
        catalogSource="repository_plus_feed"
        surfacePublished={false}
        copy={copy}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-home-catalog-source",
      "repository_plus_feed",
    );
  });

  it("exposes the honest-empty radar source on the root when nothing was injected (G43-d)", () => {
    // The fixture-backed `props` above never injects radar/promotions.
    // radarSource is resolved outside the builder (fix round 1, mirrors
    // catalogSource) — resolveHomeRadarSource degrades to honest-empty for
    // the same production-equivalent args, and HomeComposition's own default
    // (no explicit radarSource prop passed by renderHome) renders the same.
    expect(resolveHomeRadarSource({})).toBe("empty");
    const { container } = renderHome();
    expect(container.firstElementChild).toHaveAttribute(
      "data-home-radar-source",
      "empty",
    );
  });

  it("renders modules per region in ledger order (lagging article block newest-first, 2026-08-23 田平氏 GO A)", () => {
    const { container } = renderHome();
    for (const region of GRADIENT_REGIONS) {
      const section = container.querySelector(
        `[data-ledger-group="${region}"]`,
      )!;
      expect(section, region).not.toBeNull();
      const modules = [
        ...section.querySelectorAll("[data-column-module]"),
      ].map((element) => element.getAttribute("data-column-module"));
      const expected =
        region === "lagging"
          ? orderLaggingModules(props.slots)
          : [...REGION_MODULES[region]];
      expect(modules, region).toEqual(expected);
      // every region still renders exactly the ledger's module set
      expect([...modules].sort(), region).toEqual(
        [...REGION_MODULES[region]].sort(),
      );
    }
  });

  it("hides the hero at xl and keeps it free of data-article-id", () => {
    const { container } = renderHome();
    const hero = container.querySelector('[data-ledger-group="hero"]')!;
    expect(hero.classList.contains("xl:hidden")).toBe(true);
    expect(hero.querySelectorAll("[data-article-id]")).toHaveLength(0);
  });

  it("keeps session-now and the morning desk's Daily Intel block desktop-only (single representation)", () => {
    const { container } = renderHome();
    for (const module of ["session-now", "morning-desk"]) {
      const wrapper = container.querySelector(
        `[data-column-module="${module}"]`,
      )!;
      const hasDesktopOnly = (element: Element): boolean =>
        element.classList.contains("hidden") &&
        element.classList.contains("xl:block");
      expect(
        hasDesktopOnly(wrapper) ||
          [...wrapper.querySelectorAll("*")].some(hasDesktopOnly),
        module,
      ).toBe(true);
    }
  });

  it("no longer renders the masthead inside the composition (hoisted to page.tsx)", () => {
    const { container } = renderHome();
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).not.toContain(copy.masthead.title);
    expect(container.textContent).not.toContain(copy.masthead.subtitle);
  });

  it("keeps the turning-point reserved seat hidden and empty", () => {
    const { container } = renderHome();
    const seat = container.querySelector(
      '[data-column-module="turning-point-reserved"]',
    )!;
    expect(seat.hasAttribute("hidden")).toBe(true);
    expect(seat.getAttribute("aria-hidden")).toBe("true");
    expect(seat.textContent).toBe("");
  });

  it("renders the mkt12 reading as latest-only + archive link (Phase 3, 2026-08-14 / 2026-08-23 GO B-1: サムネなし行)", () => {
    const { container } = renderHome();
    const reading = container.querySelector("[data-mkt12-reading]")!;
    expect(reading).not.toBeNull();
    expect(reading.getAttribute("data-mkt12-variant")).toBe("morning");
    expect(
      [...reading.querySelectorAll("[data-mkt12-role]")].map((element) =>
        element.getAttribute("data-mkt12-role"),
      ),
    ).toEqual(["hero", "archive-link"]);
    const archiveLink = reading.querySelector(
      '[data-mkt12-role="archive-link"] a',
    )!;
    expect(archiveLink.getAttribute("href")).toBe(
      "/articles/series/mkt12-morning",
    );
  });

  // 2026-08-15 田平氏 GO: 土曜は mkt12-reading 枠を週末版モードへ切替
  // (2026-07-11 は土曜・fixture に当日週末版は無い = awaiting 分岐)
  it("switches the mkt12 reading to the weekend variant on Saturday", () => {
    // today (market clock) は fixture snapshot の 2026-07-10 のまま、
    // 記事時計 articleCutoffToday だけを土曜 2026-07-11 に進める
    const saturdayProps = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-07-11",
      contentDir: path.join(
        process.cwd(),
        "tests",
        "fixtures",
        "content",
        "articles",
      ),
    });
    const { container } = render(
      <HomeComposition {...saturdayProps} surfacePublished={false} copy={copy} />,
    );
    const reading = container.querySelector("[data-mkt12-reading]")!;
    expect(reading.getAttribute("data-mkt12-variant")).toBe("weekend");
    // 2026-08-23 GO B-1: 見出し h3 は廃止。週末系は awaiting 文言 + previous リンクで判定
    expect(reading.textContent).toContain(copy.mkt12.awaitingWeekend);
    expect(reading.textContent).toContain(copy.mkt12.previousWeekend);
    const previousLink = reading.querySelector(
      '[data-mkt12-role="hero"] a',
    )!;
    expect(previousLink.getAttribute("href")).toContain(
      "mkt12-weekend-2026-07-04",
    );
    const archiveLink = reading.querySelector(
      '[data-mkt12-role="archive-link"] a',
    )!;
    expect(archiveLink.getAttribute("href")).toBe(
      "/articles/series/mkt12-weekend",
    );
  });
});
