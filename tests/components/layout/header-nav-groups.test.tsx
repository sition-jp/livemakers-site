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
      <Header
        chromeMeta={getSnapshotChromeMeta()}
        futureAtlasNav={futureAtlasNav}
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

describe("grouped header nav (G44 D3)", () => {
  it("opens the articles dropdown to eight items while unpublished, atlas stays out of top level", () => {
    const { container } = renderHeader(false);
    const trigger = screen.getByRole("button", { name: "記事" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const menu = document.getElementById("articles-menu")!;
    const hrefs = [...menu.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual([
      "/articles/series/daily-intel",
      "/articles/series/signal",
      "/articles/series/deep-dive",
      "/articles/series/mkt12-morning",
      "/articles/series/mkt12-weekend",
      "/articles/series/event-risk-radar",
      "/brief",
      "/articles/series/future-map",
    ]);
    // no top-level future-atlas link anywhere in the header while unpublished
    expect(
      container.querySelectorAll('a[href="/future-atlas"]'),
    ).toHaveLength(0);
  });

  it("drops future-map and promotes atlas to a top-level link when published", () => {
    const { container } = renderHeader(true);
    fireEvent.click(screen.getByRole("button", { name: "記事" }));

    const menu = document.getElementById("articles-menu")!;
    const hrefs = [...menu.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toHaveLength(7);
    expect(hrefs).not.toContain("/articles/series/future-map");

    // future-atlas is a top-level nav link (outside the dropdown menu)
    const atlas = container.querySelector('nav a[href="/future-atlas"]')!;
    expect(atlas).not.toBeNull();
    expect(atlas.closest("#articles-menu")).toBeNull();
  });

  it("exposes a mobile disclosure with aria-expanded that reveals the grouped links", () => {
    renderHeader(false);
    const menuButton = screen.getByRole("button", { name: "メニュー" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("mobile-menu")).toBeNull();

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const mobile = document.getElementById("mobile-menu")!;
    // grouped articles + top-level appear in the mobile panel
    expect(
      mobile.querySelector('a[href="/articles/series/signal"]'),
    ).not.toBeNull();
    expect(mobile.querySelector('a[href="/sessions/archive"]')).not.toBeNull();
  });

  it("renders the same nav-model in the footer (flat)", () => {
    const { container } = renderFooter(false);
    // articles group entries are present flat in the footer
    expect(
      container.querySelector('a[href="/articles/series/deep-dive"]'),
    ).not.toBeNull();
    expect(container.querySelector('a[href="/brief"]')).not.toBeNull();
    expect(container.querySelector('a[href="/sessions/archive"]')).not.toBeNull();
    // unpublished: no future-atlas, future-map series present instead
    expect(container.querySelector('a[href="/future-atlas"]')).toBeNull();
    expect(
      container.querySelector('a[href="/articles/series/future-map"]'),
    ).not.toBeNull();
  });
});
