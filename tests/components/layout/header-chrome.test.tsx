/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import {
  collectScannableText,
  findLiveTokenViolations,
} from "@/lib/home/reader-grammar";
import { isAllowedChromeRoute } from "@/lib/livemakers-terminal-preview/public-topology";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ja",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
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

function renderChrome(futureAtlasNav = false) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header
        chromeMeta={getSnapshotChromeMeta()}
        futureAtlasNav={futureAtlasNav}
      />
      <Footer futureAtlasNav={futureAtlasNav} />
    </NextIntlClientProvider>,
  );
}

function renderEnglishChrome(futureAtlasNav = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Header chromeMeta={getSnapshotChromeMeta()} futureAtlasNav={futureAtlasNav} />
      <Footer futureAtlasNav={futureAtlasNav} />
    </NextIntlClientProvider>,
  );
}

describe("G41 page chrome", () => {
  it("links only to chrome-ledger routes and renders no LIVE indicator", () => {
    const { container } = renderChrome();
    for (const anchor of container.querySelectorAll(
      "header a[href], footer a[href]",
    )) {
      const href =
        anchor.getAttribute("href")!.replace(/^\/ja(?=\/|$)/, "") || "/";
      expect(isAllowedChromeRoute(href), href).toBe(true);
    }
    expect(
      findLiveTokenViolations(collectScannableText(container)),
    ).toEqual([]);
    expect(screen.getByText(/SNAPSHOT/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LIVEMAKERS" })).toBeInTheDocument();
  });

  it("reads the snapshot chip time from the fixture contract", () => {
    const meta = getSnapshotChromeMeta();
    renderChrome();
    expect(
      screen.getByText(new RegExp(`SNAPSHOT ${meta.asOfLabel}`)),
    ).toBeInTheDocument();
  });

  it("keeps the Japanese navigation labels internally consistent", () => {
    const { container } = renderChrome();
    expect(
      [...container.querySelectorAll("header nav a")].map(
        (anchor) => anchor.textContent,
      ),
    ).toEqual(["トップ", "ブリーフ", "記事", "アーカイブ", "About"]);
  });

  it("renders the Future Atlas link in both chrome navs only when published", () => {
    const { container, rerender } = renderChrome(false);
    expect(container.querySelectorAll('a[href="/future-atlas"]')).toHaveLength(0);

    rerender(
      <NextIntlClientProvider locale="ja" messages={ja}>
        <Header
          chromeMeta={getSnapshotChromeMeta()}
          futureAtlasNav
        />
        <Footer futureAtlasNav />
      </NextIntlClientProvider>,
    );

    const links = [...container.querySelectorAll('a[href="/future-atlas"]')];
    expect(links.map((link) => link.textContent)).toEqual([
      "未来アトラス",
      "未来アトラス",
    ]);
  });

  it("places exact English FUTURE ATLAS immediately after ARCHIVE in both navs", () => {
    const { container } = renderEnglishChrome(true);

    for (const nav of container.querySelectorAll("header nav, footer nav")) {
      const links = Array.from(nav.querySelectorAll("a"), (anchor) => ({
        href: anchor.getAttribute("href"),
        text: anchor.textContent,
      }));
      const archive = links.findIndex((link) => link.href === "/sessions/archive");

      expect(links[archive]).toEqual({ href: "/sessions/archive", text: "ARCHIVE" });
      expect(links[archive + 1]).toEqual({ href: "/future-atlas", text: "FUTURE ATLAS" });
    }
  });

  it("uses the Future Atlas display name across Japanese and English family labels", () => {
    expect(ja.home.family["future-map"]).toBe("未来アトラス");
    expect(ja.articles.family["future-map"]).toBe("未来アトラス");
    expect(en.home.family["future-map"]).toBe("Future Atlas");
    expect(en.articles.family["future-map"]).toBe("Future Atlas");
  });

  it("passes server-loaded chrome metadata through layout and SiteChrome", () => {
    const layout = fs.readFileSync(
      path.join(process.cwd(), "app/[locale]/layout.tsx"),
      "utf8",
    );
    const siteChrome = fs.readFileSync(
      path.join(process.cwd(), "components/layout/SiteChrome.tsx"),
      "utf8",
    );
    expect(layout).toContain("await loadHomeCompositionProps()");
    expect(layout).toContain("getSnapshotChromeMeta(props.snapshot)");
    expect(layout).toContain("await loadFutureAtlas()");
    expect(layout).toContain("<SiteChrome chromeMeta={chromeMeta} futureAtlasNav={futureAtlas.config.surfacePublished}>");
    expect(siteChrome).toContain(
      "<Header chromeMeta={chromeMeta} futureAtlasNav={futureAtlasNav} />",
    );
    expect(siteChrome).toContain("<Footer futureAtlasNav={futureAtlasNav} />");
  });
});
