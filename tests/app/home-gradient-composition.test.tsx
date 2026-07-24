/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HomeComposition } from "@/components/home/HomeComposition";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import {
  GRADIENT_REGIONS,
  REGION_MODULES,
} from "@/lib/home/gradient-ledger";
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

  it("renders modules per region in ledger order", () => {
    const { container } = renderHome();
    for (const region of GRADIENT_REGIONS) {
      const section = container.querySelector(
        `[data-ledger-group="${region}"]`,
      )!;
      expect(section, region).not.toBeNull();
      const modules = [
        ...section.querySelectorAll("[data-column-module]"),
      ].map((element) => element.getAttribute("data-column-module"));
      expect(modules, region).toEqual([...REGION_MODULES[region]]);
    }
  });

  it("hides the hero at xl and keeps it free of data-article-id", () => {
    const { container } = renderHome();
    const hero = container.querySelector('[data-ledger-group="hero"]')!;
    expect(hero.classList.contains("xl:hidden")).toBe(true);
    expect(hero.querySelectorAll("[data-article-id]")).toHaveLength(0);
  });

  it("keeps session-now and lead-article desktop-only (single representation)", () => {
    const { container } = renderHome();
    for (const module of ["session-now", "lead-article"]) {
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

  it("preserves the mkt12 reading stack (hero, periods-divider, weekend, archive)", () => {
    const { container } = renderHome();
    const reading = container.querySelector("[data-mkt12-reading]")!;
    expect(reading).not.toBeNull();
    expect(
      [...reading.querySelectorAll(":scope > [data-mkt12-role]")].map(
        (element) => element.getAttribute("data-mkt12-role"),
      ),
    ).toEqual(["hero", "periods-divider", "weekend", "archive"]);
  });
});
