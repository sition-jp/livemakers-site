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
import {
  INDEX_NAV_MODULES,
  REGION_MODULES,
} from "@/lib/home/gradient-ledger";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import { buildNavModel } from "@/lib/home/nav-model";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";
import {
  collectScannableText,
  findForbiddenDesignTerms,
  findForbiddenOpsTerms,
  findLiveTokenViolations,
  findRawInstrumentIdViolations,
} from "@/lib/home/reader-grammar";
import { collectSelectedArticleIds } from "@/lib/home/select-home-slots";
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

const stripLocale = (href: string) => href.replace(/^\/ja(?=\/|$)/, "") || "/";

/** Article/session hrefs must resolve to real documents (fail-closed against dead links). */
function expectResolvesRealDocument(href: string) {
  const article = href.match(/^\/articles\/([a-z0-9-]+)$/);
  if (article && article[1] !== "today") {
    expect(() =>
      getArticleBySlug(article[1], { contentDir: TEST_CONTENT_DIR }),
    ).not.toThrow();
  }
  const session = href.match(/^\/sessions\/(\d{4}-\d{2}-\d{2}-[a-z-]+)$/);
  if (session) {
    expect(() => getSessionRecord(session[1])).not.toThrow();
  }
}

function renderFullPage() {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header chromeMeta={getSnapshotChromeMeta()} futureAtlasNav={false} />
      <main>
        <TickerBar items={props.tickerItems} />
        <GlobalProvenanceStrip
          provenance={props.pageProvenance}
          labels={copy.provenance}
          note={copy.globalProvenanceNote}
        />
        <HomeComposition {...props} surfacePublished={false} copy={copy} />
      </main>
      <Footer futureAtlasNav={false} />
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
    now: new Date("2026-07-12T08:00:00+09:00"),
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
        <Header
          chromeMeta={getSnapshotChromeMeta(reviewed.snapshot)}
          futureAtlasNav={false}
        />
        <main>
          <TickerBar items={reviewed.tickerItems} />
          <GlobalProvenanceStrip
            provenance={reviewed.pageProvenance}
            labels={copy.provenance}
            note={copy.globalProvenanceNote}
          />
          <HomeComposition
            {...reviewed}
            surfacePublished={false}
            copy={copy}
          />
        </main>
        <Footer futureAtlasNav={false} />
      </NextIntlClientProvider>,
    ),
  };
}

describe("G44 gradient safety regression gates (page-wide, fail-closed)", () => {
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

  it("gate 2: every link validates through exactly one route (chrome / hero / gradient)", () => {
    const { container } = renderFullPage();

    // Chrome: header = logo + top-level (articles dropdown is CLOSED by default,
    // so series links are absent); footer = overview + flat nav-model. The count
    // is derived from the same nav-model, so a link leaking into chrome fails here.
    const nav = buildNavModel(false);
    const chromeAnchors = [
      ...container.querySelectorAll("header a[href], footer a[href]"),
    ];
    expect(chromeAnchors).toHaveLength(
      1 + nav.topLevel.length + (1 + nav.articlesGroup.length + nav.topLevel.length),
    );
    for (const anchor of chromeAnchors) {
      const href = stripLocale(anchor.getAttribute("href")!);
      expect(isAllowedChromeRoute(href), `chrome:${href}`).toBe(true);
    }

    // Ledger anchors partition exclusively into hero vs gradient columns (P3-4).
    const ledgerAnchors = [
      ...container.querySelectorAll("[data-ledger-group] a[href]"),
    ];
    for (const anchor of ledgerAnchors) {
      expect(anchor.closest("header, footer")).toBeNull();
    }
    const heroAnchors = ledgerAnchors.filter(
      (anchor) =>
        anchor
          .closest("[data-ledger-group]")!
          .getAttribute("data-ledger-group") === "hero",
    );
    const gradientAnchors = ledgerAnchors.filter(
      (anchor) => !heroAnchors.includes(anchor),
    );

    // Hero: index links only (session surface + lead-article route), validated
    // against the article ledger alone — ONE allowlist path, no chrome fallback.
    expect(heroAnchors).toHaveLength(1 + (props.slots.lead.article ? 1 : 0));
    for (const anchor of heroAnchors) {
      const href = stripLocale(anchor.getAttribute("href")!);
      expect(anchor.closest("[data-index-nav]"), `hero:${href}`).not.toBeNull();
      expect(isAllowedPublishedArticleRoute(href), `hero:${href}`).toBe(true);
      expectResolvesRealDocument(href);
    }

    // Gradient columns: body links must be article-ledger routes resolving to
    // real documents. Index-nav entry links may instead target a chrome surface
    // (weekly-brief entry = /brief) — still allowlisted, still one path per anchor.
    expect(gradientAnchors.length).toBeGreaterThanOrEqual(40);
    for (const anchor of gradientAnchors) {
      const href = stripLocale(anchor.getAttribute("href")!);
      if (isAllowedPublishedArticleRoute(href)) {
        expectResolvesRealDocument(href);
      } else {
        expect(
          anchor.closest("[data-index-nav]"),
          `gradient non-article link must be index-nav: ${href}`,
        ).not.toBeNull();
        expect(isAllowedChromeRoute(href), `gradient:${href}`).toBe(true);
      }
    }

    // Exact sum: no anchor outside the three buckets, none counted twice.
    expect(container.querySelectorAll("a[href]").length).toBe(
      chromeAnchors.length + heroAnchors.length + gradientAnchors.length,
    );
  });

  it("gate 3: provenance coverage matches exact packet ids and counts", () => {
    const { container } = renderFullPage();
    const packetsOf = (selector: string): string[] =>
      [
        ...container.querySelectorAll(`${selector} [data-packet-id]`),
      ].map((element) => element.getAttribute("data-packet-id")!);

    // Focus packets are DYNAMIC (P2-1): seriesPacketId = series.<date>.<instrumentId>,
    // derived from props.focusSeries — never hardcoded.
    const focusExpected = props.focusSeries
      .filter((series) => series !== null)
      .map((series) => series!.seriesPacketId);
    expect(focusExpected.length).toBeGreaterThanOrEqual(2);

    // Exhaustive matrix over the gradient ledger: the four data-bearing modules
    // carry exactly their packets; every other module (hero / article / index)
    // carries none. A module added to the ledger without a row here fails closed.
    for (const [region, modules] of Object.entries(REGION_MODULES)) {
      for (const module of modules) {
        const packets = packetsOf(`[data-column-module="${module}"]`);
        const label = `${region}/${module}`;
        switch (module) {
          case "session-now":
            expect(packets, label).toEqual(["sess_20260710_asia"]);
            break;
          case "focus":
            expect(packets, label).toEqual(focusExpected);
            break;
          case "mkt12-tiles":
            expect(packets, label).toEqual([
              "mkt12_20260710_am",
              "mkt12_20260710_am",
            ]);
            break;
          case "lane-values":
            expect(packets, label).toEqual([
              "lmk_20260710_0758_fx01",
              "lmk_20260710_0758_fx01",
              "lmk_20260710_0758_fx01",
            ]);
            break;
          default:
            expect(packets, label).toEqual([]);
        }
      }
    }

    // Per-lane anchors inside lane-values (P2-2): one packet row per lane.
    for (const lane of ["macro", "crypto", "rwa"]) {
      expect(
        packetsOf(`[data-column-module="lane-values"] [data-lane="${lane}"]`),
        `lane:${lane}`,
      ).toEqual(["lmk_20260710_0758_fx01"]);
    }

    const strip = container.querySelector(
      '[data-chrome="provenance-strip"][data-packet-id]',
    );
    expect(strip).not.toBeNull();
    expect(strip!.getAttribute("data-packet-id")).toBe(
      "sess_20260710_asia",
    );

    const mkt12 = container.querySelector(
      '[data-column-module="mkt12-tiles"]',
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
    const bodyArticleIds = [
      ...container.querySelectorAll("[data-article-id]"),
    ]
      .filter((element) => !element.closest("[data-index-nav]"))
      .map((element) => element.getAttribute("data-article-id")!);
    // Derived floor: lead 1 + mkt12 (article+weekend+archive×2) 4 + signal
    // timeline floor 10 + deep-dive featured 1 + event-risk latest 1 = 17.
    expect(bodyArticleIds.length).toBeGreaterThanOrEqual(17);
    expect(new Set(bodyArticleIds).size).toBe(bodyArticleIds.length);
    // Body ids must be exactly the builder-selected body slots — nothing extra
    // rendered as body, nothing selected but dropped.
    expect(new Set(bodyArticleIds)).toEqual(
      new Set(collectSelectedArticleIds(props.slots)),
    );

    // R3 drift assert: every INDEX_NAV_MODULES module exists in the DOM and all
    // of its links are dedup-exempt (data-index-nav on the anchor or an ancestor).
    // Ties the ledger constant to the DOM attribute so the two cannot drift.
    for (const module of INDEX_NAV_MODULES) {
      const hosts = [
        ...container.querySelectorAll(`[data-column-module="${module}"]`),
      ];
      expect(hosts.length, `module missing: ${module}`).toBeGreaterThanOrEqual(1);
      const anchors = hosts.flatMap((host) => [
        ...host.querySelectorAll("a[href]"),
      ]);
      expect(anchors.length, `no links in ${module}`).toBeGreaterThanOrEqual(1);
      for (const anchor of anchors) {
        expect(
          anchor.closest("[data-index-nav]"),
          `link in ${module} lacks data-index-nav: ${anchor.getAttribute("href")}`,
        ).not.toBeNull();
      }
    }
  });

  it("gate 7: mixed reviewed/fixture windows display only their real tuples", () => {
    const { container, reviewed } = renderReviewedPage();
    const packetsOf = (selector: string): string[] =>
      [...container.querySelectorAll(`${selector} [data-packet-id]`)].map(
        (element) => element.getAttribute("data-packet-id")!,
      );

    expect(packetsOf('[data-column-module="session-now"]')).toEqual([]);
    // Focus stays dynamic in the reviewed render too, pinned to the fixture ids.
    const focusPackets = packetsOf('[data-column-module="focus"]');
    expect(focusPackets).toEqual(
      reviewed.focusSeries
        .filter((series) => series !== null)
        .map((series) => series!.seriesPacketId),
    );
    expect(focusPackets).toEqual([
      "series.2026-07-12.btc_usd",
      "series.2026-07-12.usd_jpy",
    ]);
    expect(packetsOf('[data-column-module="mkt12-tiles"]')).toEqual([
      "mkt12_20260712_am",
      "mkt12_20260712_am",
    ]);
    const laneSelector = (lane: string) =>
      `[data-column-module="lane-values"] [data-lane="${lane}"]`;
    expect(packetsOf(laneSelector("macro"))).toEqual([
      "lmk_20260712_0730_a1",
    ]);
    expect(packetsOf(laneSelector("crypto"))).toEqual([
      "lmk_20260712_0730_a1",
    ]);
    expect(packetsOf(laneSelector("rwa"))).toEqual([
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
    expect(container.textContent).toContain("2026-07-12 07:30 JST");
    expect(
      container.querySelector('[data-column-module="mkt12-tiles"]')
        ?.textContent,
    ).toContain("2026-07-12 07:30 JST");
    expect(
      container.querySelector(laneSelector("macro"))?.textContent,
    ).toContain("2026-07-12 07:30 JST");
    expect(
      container.querySelector('[data-column-module="focus"]')?.textContent,
    ).toContain("2026-07-12 07:30 JST");
    expect(container.textContent).not.toContain(
      "2026-07-12T07:30:00+09:00",
    );
    expect(
      container.querySelector(laneSelector("rwa"))?.textContent,
    ).toContain("07:58 JST");
    expect(
      findLiveTokenViolations(collectScannableText(container)),
    ).toEqual([]);
  });
});
