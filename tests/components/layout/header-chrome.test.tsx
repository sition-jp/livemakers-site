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
import {
  isAllowedChromeExternalLink,
  isAllowedChromeRoute,
} from "@/lib/livemakers-terminal-preview/public-topology";
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
      expect(
        isAllowedChromeRoute(href) || isAllowedChromeExternalLink(href),
        href,
      ).toBe(true);
    }
    expect(
      findLiveTokenViolations(collectScannableText(container)),
    ).toEqual([]);
    expect(screen.getByRole("link", { name: "LIVEMAKERS" })).toBeInTheDocument();
  });

  it("links the official X account from both header and footer (2026-10-12)", () => {
    const { container } = renderChrome();
    for (const region of ["header", "footer"]) {
      const links = [
        ...container.querySelectorAll(`${region} a[href="https://x.com/LiveMakersCom"]`),
      ];
      expect(links, region).toHaveLength(1);
      expect(links[0]).toHaveAttribute("target", "_blank");
      expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
      expect(links[0]).toHaveAccessibleName("LiveMakers の X（@LiveMakersCom）");
    }
    // 外部リンクの許可は公式 X と運営元 sition.jp だけ (他の外部 URL は chrome に出さない)
    expect(isAllowedChromeExternalLink("https://x.com/LiveMakersCom")).toBe(true);
    expect(isAllowedChromeExternalLink("https://sition.jp")).toBe(true);
    expect(isAllowedChromeExternalLink("https://x.com/SITIONjp")).toBe(false);
    expect(isAllowedChromeExternalLink("https://example.com")).toBe(false);
  });

  it("names the operator SITION and links sition.jp from the footer (2026-10-16 田平氏決定)", () => {
    const { container } = renderChrome();
    const links = [...container.querySelectorAll('footer a[href="https://sition.jp"]')];
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(links[0]).toHaveTextContent("運営: SITION");
    expect(container.querySelectorAll('header a[href="https://sition.jp"]')).toHaveLength(0);
    const footer = container.querySelector("footer")!;
    expect(footer.textContent).toContain("LIVEMAKERS · SITION");
    expect(footer.textContent).toContain("© 2026 SITION");
    // 旧表記 (SITION Group / SITION GROUP) はフッターに残さない
    expect(footer.textContent).not.toMatch(/SITION\s+GROUP/i);
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

    // G3 (2026-09-11): footer に編集方針・連絡先・プライバシーの専用 2 段目
    // nav (`aria-label="footer-legal"`) が増えた。これは flatNav (記事▾ 等)
    // と無関係の別ナビなので、flatNav の並び順を検証するこのループの対象外にする。
    for (const nav of container.querySelectorAll(
      'header nav, footer nav:not([aria-label="footer-legal"])',
    )) {
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
    // 2026-10-26 段 1: 共通の枠は記事カタログを読まない (loadChromeProps)
    expect(layout).toContain("await loadChromeProps()");
    expect(layout).toContain("getSnapshotChromeMeta(chrome.snapshot)");
    expect(layout).toContain("await loadFutureAtlas()");
    // T4-2 (P0-7) の nav は実効 surfacePublished (config OR feed) だったが、
    // 2026-10-26 段 1 で共通の枠は config だけを見る (feed = 記事カタログを読まない)。
    // 未来アトラスの本体ページ・一覧ページは引き続き実効値で判定する
    // 2026-08-14: ticker/来歴の全ページ化で props が増えた (複数行 JSX)
    expect(layout).toContain("chromeMeta={chromeMeta}");
    expect(layout).toContain("futureAtlasNav={surfacePublished}");
    expect(layout).toContain("tickerItems={chrome.tickerItems}");
    expect(layout).toContain("pageProvenance={chrome.pageProvenance}");
    expect(layout).toContain("futureAtlas.config.surfacePublished");
    expect(layout).not.toContain("loadEffectiveSurfacePublished");
    expect(siteChrome).toContain(
      "<Header futureAtlasNav={futureAtlasNav} />",
    );
    expect(siteChrome).toContain("<Footer futureAtlasNav={futureAtlasNav} />");
  });
});
