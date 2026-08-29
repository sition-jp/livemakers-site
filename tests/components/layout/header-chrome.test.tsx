/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/layout/Footer";
import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { Header } from "@/components/layout/Header";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import {
  collectScannableText,
  findLiveTokenViolations,
} from "@/lib/home/reader-grammar";
import { isAllowedChromeRoute } from "@/lib/livemakers-terminal-preview/public-topology";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";

vi.mock("@/lib/future-atlas/surface", () => ({
  // T4-2: 実効 surface は config 値へ縮退させる (feed 照会は結合対象外)
  loadEffectiveSurfacePublished: vi.fn(
    async (data: { config: { surfacePublished: boolean } }) =>
      data.config.surfacePublished,
  ),
}));
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
  usePathname: () => "/",
}));

function renderChrome(futureAtlasNav = false) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header futureAtlasNav={futureAtlasNav}
      />
      <Footer futureAtlasNav={futureAtlasNav} />
    </NextIntlClientProvider>,
  );
}

function renderEnglishChrome(futureAtlasNav = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Header futureAtlasNav={futureAtlasNav} />
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
        anchor.getAttribute("href")!.replace(/^\/(ja|en)(?=\/|$)/, "") || "/";
      expect(isAllowedChromeRoute(href), href).toBe(true);
    }
    expect(
      findLiveTokenViolations(collectScannableText(container)),
    ).toEqual([]);
    expect(screen.getByRole("link", { name: "LIVEMAKERS" })).toBeInTheDocument();
  });

  it("reads the snapshot chip time in the provenance strip (2026-08-14 移設)", () => {
    const meta = getSnapshotChromeMeta();
    render(
      <NextIntlClientProvider locale="ja" messages={ja}>
        <GlobalProvenanceStrip
          provenance={{
            packetId: meta ? "lmk_20260710_0758_fx01" : "x",
            sourceMode: "fixture_only",
            reviewStatus: "reviewed_fixture",
            asOfJst: meta.asOfLabel,
          }}
          labels={{ review: "審査状態", source: "ソース", asOf: "as-of",
                    packet: "パケットID" }}
          note="数値は取得時点のスナップショットです"
          chromeMeta={meta}
          snapshotLabel="SNAPSHOT"
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByText(new RegExp(`SNAPSHOT ${meta.asOfLabel}`)),
    ).toBeInTheDocument();
    // 注記は来歴の直後に inline (右端固定は旧仕様)
    expect(
      screen.getByText("数値は取得時点のスナップショットです"),
    ).toBeInTheDocument();
  });

  it("keeps the Japanese navigation labels internally consistent (flat)", () => {
    const { container } = renderChrome();
    // 2026-08-14: dropdown 廃止 — フラット 1 列 (先頭 = トップ / Intelligence Terminal)
    expect(container.querySelector('button[aria-controls="articles-menu"]'))
      .toBeNull();
    const labels = [...container.querySelectorAll('header nav a')].map(
      (anchor) => anchor.textContent,
    );
    expect(labels[0]).toBe("トップ");
    expect(labels[1]).toBe("Intelligence Terminal");
    expect(labels[labels.length - 1]).toBe("About");
  });

  it("renders the Future Atlas link in both chrome navs only when published", () => {
    const { container, rerender } = renderChrome(false);
    expect(container.querySelectorAll('a[href="/future-atlas"]')).toHaveLength(0);

    rerender(
      <NextIntlClientProvider locale="ja" messages={ja}>
        <Header futureAtlasNav
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

  it("places English FUTURE ATLAS between INTELLIGENCE TERMINAL and ABOUT in both navs (Phase 3 order)", () => {
    const { container } = renderEnglishChrome(true);

    for (const nav of container.querySelectorAll("header nav, footer nav")) {
      const links = Array.from(nav.querySelectorAll("a"), (anchor) => ({
        href: anchor.getAttribute("href"),
        text: anchor.textContent,
      }));
      const atlas = links.findIndex((link) => link.href === "/future-atlas");

      expect(atlas).toBeGreaterThanOrEqual(0);
      expect(links[atlas]).toEqual({ href: "/future-atlas", text: "FUTURE ATLAS" });
      // 2026-08-14 フラットナビ: atlas は About の直前 (旧 futureMap の位置)
      expect(links[atlas + 1]).toEqual({
        href: "/about",
        text: "ABOUT",
      });
      expect(links.some((link) => link.href === "/sessions/archive")).toBe(true);
    }
  });

  it("names the future-map series 次の時代の地図 across locales (2026-08-07 田平氏裁定)", () => {
    // 「次の時代の地図」(future-map シリーズ) と「未来アトラス」(future-atlas・
    // 田平氏手動記事) は別物 — シリーズ側に未来アトラスの名を使わない
    expect(ja.home.family["future-map"]).toBe("次の時代の地図");
    expect(ja.articles.family["future-map"]).toBe("次の時代の地図");
    expect(en.home.family["future-map"]).toBe("Map of the Next Era");
    expect(en.articles.family["future-map"]).toBe("Map of the Next Era");
    expect(ja.articles.family["future-atlas"]).toBe("未来アトラス");
    expect(en.articles.family["future-atlas"]).toBe("Future Atlas");
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
    // T4-2 (P0-7): nav は実効 surfacePublished (config OR feed) を参照する
    // 2026-08-14: ticker/来歴の全ページ化で props が増えた (複数行 JSX)
    expect(layout).toContain("chromeMeta={chromeMeta}");
    expect(layout).toContain("futureAtlasNav={surfacePublished}");
    expect(layout).toContain("tickerItems={props.tickerItems}");
    expect(layout).toContain("pageProvenance={props.pageProvenance}");
    expect(layout).toContain("loadEffectiveSurfacePublished(futureAtlas)");
    expect(siteChrome).toContain(
      "<Header futureAtlasNav={futureAtlasNav} />",
    );
    expect(siteChrome).toContain("<Footer futureAtlasNav={futureAtlasNav} />");
  });
});
