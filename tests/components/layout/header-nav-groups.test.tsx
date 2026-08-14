/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import ja from "@/messages/ja.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ja",
}));

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

function renderHeader(futureAtlasNav: boolean) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header futureAtlasNav={futureAtlasNav}
      />
    </NextIntlClientProvider>,
  );
}

function renderFooter(futureAtlasNav: boolean) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Footer futureAtlasNav={futureAtlasNav} />
    </NextIntlClientProvider>,
  );
}

describe("flat header nav (2026-08-14 田平氏指示 — dropdown 廃止)", () => {
  const EXPECTED_UNPUBLISHED = [
    "/",
    "/sessions/archive",
    "/articles/series/daily-intel",
    "/articles/series/signal",
    "/articles/series/deep-dive",
    "/articles/series/mkt12-morning",
    "/articles/series/mkt12-weekend",
    "/articles/series/event-risk-radar",
    "/brief",
    "/articles/series/future-map",
    "/about",
  ];

  it("renders the flat left-aligned nav in the fixed order (unpublished)", () => {
    const { container } = renderHeader(false);
    const nav = container.querySelector('nav[aria-label="primary"]')!;
    expect([...nav.querySelectorAll("a")].map((a) => a.getAttribute("href")))
      .toEqual(EXPECTED_UNPUBLISHED);
    // dropdown は存在しない (ポップアップなしの田平氏指示)
    expect(container.querySelector('button[aria-controls="articles-menu"]'))
      .toBeNull();
    // 先頭 2 つのラベル
    const labels = [...nav.querySelectorAll("a")].map((a) => a.textContent);
    expect(labels[0]).toBe("トップ");
    expect(labels[1]).toBe("Intelligence Terminal");
  });

  it("swaps future-map for future-atlas at the same slot when published", () => {
    const { container } = renderHeader(true);
    const nav = container.querySelector('nav[aria-label="primary"]')!;
    const hrefs = [...nav.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).not.toContain("/articles/series/future-map");
    expect(hrefs.indexOf("/future-atlas")).toBe(hrefs.length - 2);
    expect(hrefs[hrefs.length - 1]).toBe("/about");
  });

  it("exposes a mobile disclosure with the same flat order", () => {
    renderHeader(false);
    const menuButton = screen.getByRole("button", { name: "メニュー" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("mobile-menu")).toBeNull();

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const mobile = document.getElementById("mobile-menu")!;
    expect([...mobile.querySelectorAll("a")].map((a) => a.getAttribute("href")))
      .toEqual(EXPECTED_UNPUBLISHED);
  });

  it("renders the footer nav in the same flat order", () => {
    const { container } = renderFooter(false);
    const nav = container.querySelector('nav[aria-label="footer"]')!;
    expect([...nav.querySelectorAll("a")].map((a) => a.getAttribute("href")))
      .toEqual(EXPECTED_UNPUBLISHED);
  });
});
