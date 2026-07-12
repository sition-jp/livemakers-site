/* @vitest-environment jsdom */
import path from "node:path";
import fs from "node:fs";

import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { HomeComposition } from "@/components/home/HomeComposition";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TickerBar } from "@/components/terminal/TickerBar";
import { getArticleBySlug } from "@/lib/articles/article-model";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";
import {
  collectScannableText,
  findForbiddenDesignTerms,
  findForbiddenOpsTerms,
  findLiveTokenViolations,
  findRawInstrumentIdViolations,
} from "@/lib/home/reader-grammar";
import {
  isAllowedChromeRoute,
  isAllowedPublishedArticleRoute,
} from "@/lib/livemakers-terminal-preview/public-topology";
import { getSessionRecord } from "@/lib/sessions/session-content";
import { mapTerminalFeed } from "@/lib/terminal/live-market-feed";
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

const TEST_CONTENT_DIR = path.join(process.cwd(), "tests", "fixtures", "content", "articles");
const props = buildHomeCompositionProps({
  today: "2026-07-10",
  contentDir: TEST_CONTENT_DIR,
});
const copy = buildTestHomeCopy();

function renderFullPage() {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header chromeMeta={getSnapshotChromeMeta()} />
      <main>
        <TickerBar items={props.tickerItems} />
        <GlobalProvenanceStrip
          provenance={props.pageProvenance}
          labels={copy.provenance}
          note={copy.globalProvenanceNote}
        />
        <HomeComposition {...props} copy={copy} />
      </main>
      <Footer />
    </NextIntlClientProvider>,
  );
}

function reviewedProps() {
  const feed = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "tests/fixtures/terminal/terminal_feed_v0.2.home.sample.json",
      ),
      "utf8",
    ),
  );
  const source = mapTerminalFeed(feed)?.home;
  if (!source) throw new Error("valid reviewed fixture did not map");
  return buildHomeCompositionProps({
    source,
    contentDir: TEST_CONTENT_DIR,
    sessionRecords: [getSessionRecord("2026-07-10-asia-open")],
  });
}

function renderReviewedPage() {
  const reviewed = reviewedProps();
  return {
    reviewed,
    ...render(
      <NextIntlClientProvider locale="ja" messages={ja}>
        <Header chromeMeta={getSnapshotChromeMeta(reviewed.snapshot)} />
        <main>
          <TickerBar items={reviewed.tickerItems} />
          <GlobalProvenanceStrip
            provenance={reviewed.pageProvenance}
            labels={copy.provenance}
            note={copy.globalProvenanceNote}
          />
          <HomeComposition {...reviewed} copy={copy} />
        </main>
        <Footer />
      </NextIntlClientProvider>,
    ),
  };
}

describe("B+ safety regression gates (page-wide, fail-closed)", () => {
  it("gate 1: radar payload and DOM remain title-only", () => {
    for (const observation of RADAR_OBSERVATIONS) {
      expect(observation.href).toBeNull();
      expect(observation.displayMode).toBe("title_only");
      expect(observation.publishDecision).toBe("not_authorized");
    }
    const { container } = renderFullPage();
    const radarModules = container.querySelectorAll("[data-radar]");
    expect(radarModules.length).toBeGreaterThanOrEqual(1);
    for (const module of radarModules) {
      expect(module.querySelectorAll("a")).toHaveLength(0);
    }
  });

  it("gate 2: hrefs validate against their own region and real documents", () => {
    const { container } = renderFullPage();
    const stripLocale = (href: string) =>
      href.replace(/^\/ja(?=\/|$)/, "") || "/";
    const chromeHrefs = [
      ...container.querySelectorAll("header a[href], footer a[href]"),
    ].map((anchor) => stripLocale(anchor.getAttribute("href")!));
    expect(chromeHrefs.length).toBeGreaterThanOrEqual(4);
    for (const href of chromeHrefs) {
      expect(isAllowedChromeRoute(href), `chrome:${href}`).toBe(true);
    }

    const articleHrefs = [
      ...container.querySelectorAll("[data-ledger-group] a[href]"),
    ].map((anchor) => stripLocale(anchor.getAttribute("href")!));
    expect(articleHrefs.length).toBeGreaterThan(20);
    for (const href of articleHrefs) {
      expect(
        isAllowedPublishedArticleRoute(href),
        `article:${href}`,
      ).toBe(true);
      const article = href.match(/^\/articles\/([a-z0-9-]+)$/);
      if (article && article[1] !== "today") {
        expect(() =>
          getArticleBySlug(article[1], { contentDir: TEST_CONTENT_DIR }),
        ).not.toThrow();
      }
      const session = href.match(
        /^\/sessions\/(\d{4}-\d{2}-\d{2}-[a-z-]+)$/,
      );
      if (session) {
        expect(() => getSessionRecord(session[1])).not.toThrow();
      }
    }
    expect(container.querySelectorAll("a[href]").length).toBe(
      chromeHrefs.length + articleHrefs.length,
    );
  });

  it("gate 3: provenance coverage matches exact packet ids and counts", () => {
    const { container } = renderFullPage();
    const packetsOf = (selector: string): string[] =>
      [
        ...container.querySelectorAll(`${selector} [data-packet-id]`),
      ].map((element) => element.getAttribute("data-packet-id")!);

    expect(packetsOf('[data-lead-module="session-now"]')).toEqual([
      "sess_20260710_asia",
    ]);
    const focusPackets = packetsOf('[data-lead-module="focus"]');
    expect(focusPackets).toEqual(
      props.focusSeries
        .filter((series) => series !== null)
        .map((series) => series!.seriesPacketId),
    );
    expect(focusPackets.length).toBeGreaterThanOrEqual(2);
    expect(packetsOf('[data-ledger-group="mkt12"]')).toEqual([
      "mkt12_20260710_am",
      "mkt12_20260710_am",
    ]);
    for (const lane of ["lane-macro", "lane-crypto", "lane-rwa"]) {
      expect(packetsOf(`[data-ledger-group="${lane}"]`)).toEqual([
        "lmk_20260710_0758_fx01",
      ]);
    }
    const strip = container.querySelector(
      '[data-chrome="provenance-strip"][data-packet-id]',
    );
    expect(strip).not.toBeNull();
    expect(strip!.getAttribute("data-packet-id")).toBe(
      "sess_20260710_asia",
    );
    expect(packetsOf('[data-ledger-group="flash"]')).toEqual([]);

    const mkt12 = container.querySelector(
      '[data-ledger-group="mkt12"]',
    )!;
    for (const value of [
      "審査状態",
      "reviewed_fixture",
      "fixture_only",
      "as-of",
      "パケットID",
    ]) {
      expect(mkt12.textContent).toContain(value);
    }
  });

  it("gate 4: no standalone LIVE token appears in chrome or content", () => {
    const { container } = renderFullPage();
    expect(
      findLiveTokenViolations(collectScannableText(container)),
    ).toEqual([]);
  });

  it("gate 5: no internal operations or design vocabulary is visible", () => {
    const { container } = renderFullPage();
    const text = collectScannableText(container);
    expect(findForbiddenOpsTerms(text)).toEqual([]);
    expect(findForbiddenDesignTerms(text)).toEqual([]);
    const focusLabels = [
      ...container.querySelectorAll("[data-focus-instrument-label]"),
    ]
      .map((element) => element.textContent ?? "")
      .join(" ");
    expect(findRawInstrumentIdViolations(focusLabels)).toEqual([]);
  });

  it("gate 6: rendered article ids are unique outside index navigation", () => {
    const { container } = renderFullPage();
    const articleIds = [
      ...container.querySelectorAll("[data-article-id]"),
    ]
      .filter((element) => !element.closest("[data-index-nav]"))
      .map((element) => element.getAttribute("data-article-id")!);
    expect(articleIds.length).toBeGreaterThanOrEqual(14);
    expect(new Set(articleIds).size).toBe(articleIds.length);
  });

  it("gate 7: mixed reviewed/fixture windows display only their real tuples", () => {
    const { container, reviewed } = renderReviewedPage();
    const packetsOf = (selector: string): string[] =>
      [...container.querySelectorAll(`${selector} [data-packet-id]`)].map(
        (element) => element.getAttribute("data-packet-id")!,
      );

    expect(packetsOf('[data-lead-module="session-now"]')).toEqual([]);
    expect(packetsOf('[data-lead-module="focus"]')).toEqual([
      "series.2026-07-12.btc_usd",
      "series.2026-07-12.usd_jpy",
    ]);
    expect(packetsOf('[data-ledger-group="mkt12"]')).toEqual([
      "mkt12_20260712_am",
      "mkt12_20260712_am",
    ]);
    expect(packetsOf('[data-ledger-group="lane-macro"]')).toEqual([
      "lmk_20260712_0730_a1",
    ]);
    expect(packetsOf('[data-ledger-group="lane-crypto"]')).toEqual([
      "lmk_20260712_0730_a1",
    ]);
    expect(packetsOf('[data-ledger-group="lane-rwa"]')).toEqual([
      "lmk_20260710_0758_fx01",
    ]);

    const strip = container.querySelector(
      '[data-chrome="provenance-strip"][data-packet-id]',
    )!;
    expect(strip.getAttribute("data-packet-id")).toBe(
      "lmk_20260710_0758_fx01",
    );
    expect(strip.textContent).toContain("fixture_only");
    expect(strip.textContent).toContain("reviewed_fixture");
    expect(strip.textContent).toContain("07:58 JST");
    expect(reviewed.pageProvenance).toEqual(reviewed.laneProvenance.rwa);
    expect(container.textContent).toContain("Asia Open");
    expect(container.textContent).toContain("2026-07-12");
    expect(container.textContent).toContain("07:30 JST");
    expect(
      findLiveTokenViolations(collectScannableText(container)),
    ).toEqual([]);
  });
});
