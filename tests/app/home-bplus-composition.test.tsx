/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HomeComposition } from "@/components/home/HomeComposition";
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

describe("B+ home composition (doctrine §4 nine-group ledger)", () => {
  const props = buildHomeCompositionProps({ today: "2026-07-10" });
  const copy = buildTestHomeCopy();

  it("renders the locked reader-facing co-equal masthead copy", () => {
    render(<HomeComposition {...props} copy={copy} />);
    expect(
      screen.getByRole("heading", { name: "いまを見る ⇄ 今日を読む" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("市場のいまと、今日の読み解きをひと目で"),
    ).toBeInTheDocument();
  });

  it("orders priority groups exactly per the 2026-07-10 ledger", () => {
    const { container } = render(
      <HomeComposition {...props} copy={copy} />,
    );
    const ids = [...container.querySelectorAll("[data-ledger-group]")].map(
      (element) => element.getAttribute("data-ledger-group"),
    );
    expect(ids).toEqual([
      "lead",
      "mkt12",
      "flash",
      "lane-macro",
      "lane-crypto",
      "lane-rwa",
      "turning-point-reserved",
      "library",
    ]);
  });

  it("keeps the group-1 mobile DOM adjacency contract", () => {
    const { container } = render(
      <HomeComposition {...props} copy={copy} />,
    );
    const lead = container.querySelector('[data-ledger-group="lead"]')!;
    expect(
      [...lead.querySelectorAll("[data-lead-module]")].map((element) =>
        element.getAttribute("data-lead-module"),
      ),
    ).toEqual([
      "session-now",
      "lead-article",
      "schedule",
      "focus",
      "series-index",
    ]);
  });

  it("keeps the turning-point seat hidden and empty", () => {
    const { container } = render(
      <HomeComposition {...props} copy={copy} />,
    );
    const seat = container.querySelector(
      '[data-ledger-group="turning-point-reserved"]',
    )!;
    expect(seat.hasAttribute("hidden")).toBe(true);
    expect(seat.textContent).toBe("");
  });

  it("renders no anchors inside explicitly marked radar modules", () => {
    const { container } = render(
      <HomeComposition {...props} copy={copy} />,
    );
    expect(
      container.querySelectorAll(
        '[data-ledger-group="flash"] [data-radar] a',
      ),
    ).toHaveLength(0);
  });
});
