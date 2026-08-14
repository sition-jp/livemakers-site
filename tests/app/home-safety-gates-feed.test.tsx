/* @vitest-environment jsdom */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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

import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { HomeComposition } from "@/components/home/HomeComposition";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TickerBar } from "@/components/terminal/TickerBar";
import {
  buildArticleInflowPublicCatalog,
  parseArticleInflowFeed,
  type ArticleInflowPublicArticle,
  type ArticleInflowPublicCatalog,
} from "@/lib/articles/article-inflow-contract";
import {
  getAllArticles,
  getArticleBySlug,
} from "@/lib/articles/article-model";
import {
  ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
  ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
  loadPublicArticleInflowDetail,
} from "@/lib/articles/article-inflow-feed";
import {
  buildHomeCompositionProps,
  type BuildHomeCompositionArgs,
} from "@/lib/home/build-home-props";
import {
  INDEX_NAV_MODULES,
  REGION_MODULES,
} from "@/lib/home/gradient-ledger";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import { buildFlatNav } from "@/lib/home/nav-model";
import {
  RADAR_OBSERVATIONS,
  RADAR_SOURCE_URL_ALLOWLIST,
  type RadarObservation,
} from "@/lib/home/radar-observations";
import { RADAR_PROMOTIONS } from "@/lib/home/radar-promotions";
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
import {
  mapTerminalFeed,
  type ReviewedHomeData,
} from "@/lib/terminal/live-market-feed";
import ja from "@/messages/ja.json";

const copy = buildTestHomeCopy();
const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);
let catalog: ArticleInflowPublicCatalog;
let props: ReturnType<typeof buildHomeCompositionProps>;

function feedArticle(overrides: Record<string, unknown> = {}) {
  const body = "# Feed overlay safety fixture\n";
  return {
    slug: "signal-20260710-feed-safety",
    title: "検証済みの公開記事",
    family: "signal",
    source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
    published_at: "2026-07-10T03:00:00Z",
    body,
    body_checksum: createHash("sha256").update(body, "utf8").digest("hex"),
    validator: {
      verdict: "green",
      vocabulary_version: "99f41b7549a0a4f5",
    },
    ...overrides,
  };
}

function productionFeed(article = feedArticle()) {
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "production",
    generated_at: "2026-07-10T12:05:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles: [article],
  };
}

function buildPublicCatalog(article = feedArticle()) {
  const feed = parseArticleInflowFeed(productionFeed(article));
  if (!feed) throw new Error("valid Production feed fixture did not parse");
  return buildArticleInflowPublicCatalog(
    getAllArticles({ contentDir: TEST_CONTENT_DIR }),
    feed,
  );
}

function reviewedHomeSource(): ReviewedHomeData {
  const feed = JSON.parse(
    fs.readFileSync(
      "tests/fixtures/terminal/terminal_feed_v0.2.home.sample.json",
      "utf8",
    ),
  );
  const source = mapTerminalFeed(feed)?.home;
  if (!source) throw new Error("valid reviewed fixture did not map");
  return source;
}

// 2026-08-14 田平氏裁定: 観測は一次ソース (X) へ外部リンク可 — gate 検証用。
const LINKED_RADAR_OBSERVATION: RadarObservation = {
  topicId: "linked_source_20260710",
  lane: "x_news_trends",
  titleJa: "米SECが暗号資産の開示規則案を公表",
  observedAtLabel: "08:02",
  href: "https://x.com/example/status/1234509876",
  displayMode: "title_with_source",
  publishDecision: "not_authorized",
};
const RADAR_WITH_SOURCE: readonly RadarObservation[] = [
  ...RADAR_OBSERVATIONS,
  LINKED_RADAR_OBSERVATION,
];

function buildOverlayProps(
  articles: ArticleInflowPublicArticle[],
  extra: BuildHomeCompositionArgs = {},
) {
  return buildHomeCompositionProps({
    today: "2026-07-10",
    articleCutoffToday: "2026-07-10",
    articles,
    // G43-d: production default radar is now honest-empty (no feed/
    // injection). These page-wide gates inject the former fixture
    // population explicitly so their assertions keep exercising a
    // populated radar (gate meaning unchanged).
    // 2026-08-14 裁定: リンク付き観測 1 件を混ぜて data-source-link 会計を検証。
    radar: RADAR_WITH_SOURCE,
    promotions: RADAR_PROMOTIONS,
    ...extra,
  });
}

function renderFullPage(
  homeProps: ReturnType<typeof buildHomeCompositionProps>,
) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header futureAtlasNav={false}
      />
      <main>
        <TickerBar items={homeProps.tickerItems} />
        <GlobalProvenanceStrip
          provenance={homeProps.pageProvenance}
          labels={copy.provenance}
          note={copy.globalProvenanceNote}
        />
        <HomeComposition
          {...homeProps}
          catalogSource="repository_plus_feed"
          surfacePublished={false}
          copy={copy}
        />
      </main>
      <Footer futureAtlasNav={false} />
    </NextIntlClientProvider>,
  );
}

const stripLocale = (href: string) =>
  href.replace(/^\/ja(?=\/|$)/, "") || "/";

/** Resolve through the same repo + feed contract used by the public article route. */
async function expectResolvesPublicDocument(
  href: string,
  resolutionCatalog: ArticleInflowPublicCatalog = catalog,
) {
  const article = href.match(/^\/articles\/([a-z0-9-]+)$/);
  if (article && article[1] !== "today") {
    const candidate = resolutionCatalog.articles.find(
      (item) => item.articleId === article[1],
    );
    if (!candidate) {
      throw new Error(`article not found in public catalog: ${article[1]}`);
    }
    if (candidate.source === "inflow") {
      const detail = await loadPublicArticleInflowDetail(article[1], "ja");
      if (!detail || detail.article.articleId !== article[1]) {
        throw new Error(`public detail did not resolve: ${article[1]}`);
      }
    } else {
      expect(() =>
        getArticleBySlug(article[1], { contentDir: TEST_CONTENT_DIR }),
      ).not.toThrow();
    }
  }
  const session = href.match(
    /^\/sessions\/(\d{4}-\d{2}-\d{2}-[a-z-]+)$/,
  );
  if (session) {
    expect(() => getSessionRecord(session[1])).not.toThrow();
  }
}

function assertReaderVocabulary(container: HTMLElement) {
  const text = collectScannableText(container);
  const violations = [
    ...findForbiddenOpsTerms(text),
    ...findForbiddenDesignTerms(text),
  ];
  if (violations.length > 0) {
    throw new Error(`forbidden reader vocabulary: ${violations.join(", ")}`);
  }
  const focusLabels = [
    ...container.querySelectorAll("[data-focus-instrument-label]"),
  ]
    .map((element) => element.textContent ?? "")
    .join(" ");
  const rawIds = findRawInstrumentIdViolations(focusLabels);
  if (rawIds.length > 0) {
    throw new Error(`raw instrument ids: ${rawIds.join(", ")}`);
  }
}

beforeAll(() => {
  vi.stubEnv(ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY, "true");
  vi.stubEnv(
    ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
    "https://fixtures.invalid/article-inflow-production.json",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(productionFeed()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  catalog = buildPublicCatalog();
  props = buildOverlayProps(catalog.articles);
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("G44 safety gates with validated Production feed overlay", () => {
  it("gate 1: radar DOM carries primary-source links only, never article routing", () => {
    expect(catalog.feedPresent).toBe(true);
    expect(
      catalog.articles.find(
        (article) => article.articleId === "signal-20260710-feed-safety",
      )?.source,
    ).toBe("inflow");
    // 従来 fixture (href=null) は title-only のまま (2026-08-14 裁定で改訂)。
    for (const observation of RADAR_OBSERVATIONS) {
      expect(observation.href).toBeNull();
      expect(observation.displayMode).toBe("title_only");
      expect(observation.publishDecision).toBe("not_authorized");
    }
    const { container } = renderFullPage(props);
    const radarModules = container.querySelectorAll("[data-radar]");
    expect(radarModules.length).toBeGreaterThanOrEqual(1);
    const radarAnchors = [...container.querySelectorAll("[data-radar] a")];
    // リンクを持つのは注入した LINKED_RADAR_OBSERVATION の 1 件のみ。
    expect(radarAnchors).toHaveLength(1);
    for (const anchor of radarAnchors) {
      expect(anchor.hasAttribute("data-source-link")).toBe(true);
      expect(anchor.hasAttribute("data-article-id")).toBe(false);
      expect(anchor.hasAttribute("data-index-nav")).toBe(false);
      expect(
        RADAR_SOURCE_URL_ALLOWLIST.test(anchor.getAttribute("href")!),
      ).toBe(true);
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    }
  });

  it("gate 2: every link validates through exactly one public route", async () => {
    const { container } = renderFullPage(props);
    // 2026-08-14 フラットナビ: header = logo + flatNav / footer = flatNav
    const flat = buildFlatNav(false);
    const chromeAnchors = [
      ...container.querySelectorAll("header a[href], footer a[href]"),
    ];
    expect(chromeAnchors).toHaveLength(1 + flat.length + flat.length);
    for (const anchor of chromeAnchors) {
      const href = stripLocale(anchor.getAttribute("href")!);
      expect(isAllowedChromeRoute(href), `chrome:${href}`).toBe(true);
    }

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

    expect(heroAnchors).toHaveLength(1 + (props.slots.lead.article ? 1 : 0));
    for (const anchor of heroAnchors) {
      const href = stripLocale(anchor.getAttribute("href")!);
      expect(anchor.closest("[data-index-nav]"), `hero:${href}`).not.toBeNull();
      expect(isAllowedPublishedArticleRoute(href), `hero:${href}`).toBe(true);
      await expectResolvesPublicDocument(href);
    }

    // Primary-source links (2026-08-14 裁定): data-source-link は data-radar
    // 内限定・X allowlist の外部 1 hop。第 4 のバケットとして明示会計する。
    const sourceAnchors = gradientAnchors.filter((anchor) =>
      anchor.hasAttribute("data-source-link"),
    );
    expect(sourceAnchors).toHaveLength(1);
    for (const anchor of sourceAnchors) {
      const href = anchor.getAttribute("href")!;
      expect(RADAR_SOURCE_URL_ALLOWLIST.test(href), `source:${href}`).toBe(
        true,
      );
      expect(anchor.closest("[data-radar]"), `source:${href}`).not.toBeNull();
      expect(anchor.getAttribute("target")).toBe("_blank");
      expect(anchor.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    }

    const gradientBodyAnchors = gradientAnchors.filter(
      (anchor) => !sourceAnchors.includes(anchor),
    );
    expect(gradientBodyAnchors.length).toBeGreaterThanOrEqual(40);
    for (const anchor of gradientBodyAnchors) {
      const href = stripLocale(anchor.getAttribute("href")!);
      if (isAllowedPublishedArticleRoute(href)) {
        await expectResolvesPublicDocument(href);
      } else {
        expect(
          anchor.closest("[data-index-nav]"),
          `gradient non-article link must be index-nav: ${href}`,
        ).not.toBeNull();
        expect(isAllowedChromeRoute(href), `gradient:${href}`).toBe(true);
      }
    }
    expect(container.querySelectorAll("a[href]").length).toBe(
      chromeAnchors.length + heroAnchors.length + gradientAnchors.length,
    );
  });

  it("gate 3: provenance counts and catalog-source data contract stay exact", () => {
    const { container } = renderFullPage(props);
    const packetsOf = (selector: string): string[] =>
      [...container.querySelectorAll(`${selector} [data-packet-id]`)].map(
        (element) => element.getAttribute("data-packet-id")!,
      );
    const focusExpected = props.focusSeries
      .filter((series) => series !== null)
      .map((series) => series!.seriesPacketId);
    expect(focusExpected.length).toBeGreaterThanOrEqual(2);

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
    for (const lane of ["macro", "crypto", "rwa"]) {
      expect(
        packetsOf(
          `[data-column-module="lane-values"] [data-lane="${lane}"]`,
        ),
        `lane:${lane}`,
      ).toEqual(["lmk_20260710_0758_fx01"]);
    }
    expect(
      container
        .querySelector('[data-home-catalog-source]')
        ?.getAttribute("data-home-catalog-source"),
    ).toBe("repository_plus_feed");
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

  it("gate 4: no standalone LIVE token appears", () => {
    const { container } = renderFullPage(props);
    expect(findLiveTokenViolations(collectScannableText(container))).toEqual(
      [],
    );
  });

  it("gate 5: no internal operations or design vocabulary is visible", () => {
    const { container } = renderFullPage(props);
    expect(() => assertReaderVocabulary(container)).not.toThrow();
  });

  it("gate 6: rendered body article ids stay unique and complete", () => {
    const { container } = renderFullPage(props);
    const bodyArticleIds = [
      ...container.querySelectorAll("[data-article-id]"),
    ]
      .filter((element) => !element.closest("[data-index-nav]"))
      .map((element) => element.getAttribute("data-article-id")!);
    // Phase 3 (2026-08-14): mkt12 weekend/archive を本体から撤去 → floor 14
    expect(bodyArticleIds.length).toBeGreaterThanOrEqual(14);
    expect(new Set(bodyArticleIds).size).toBe(bodyArticleIds.length);
    expect(new Set(bodyArticleIds)).toEqual(
      new Set(collectSelectedArticleIds(props.slots)),
    );
    expect(bodyArticleIds).toContain("signal-20260710-feed-safety");

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

  it("gate 7: reviewed and fixture windows keep only their real tuples", () => {
    const reviewed = buildOverlayProps(catalog.articles, {
      source: reviewedHomeSource(),
      now: new Date("2026-07-12T08:00:00+09:00"),
      today: undefined,
      articleCutoffToday: undefined,
      sessionRecords: [getSessionRecord("2026-07-10-asia-open")],
    });
    const { container } = renderFullPage(reviewed);
    const packetsOf = (selector: string): string[] =>
      [...container.querySelectorAll(`${selector} [data-packet-id]`)].map(
        (element) => element.getAttribute("data-packet-id")!,
      );
    expect(packetsOf('[data-column-module="session-now"]')).toEqual([]);
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
    expect(findLiveTokenViolations(collectScannableText(container))).toEqual(
      [],
    );
    expect(
      container
        .querySelector('[data-home-catalog-source]')
        ?.getAttribute("data-home-catalog-source"),
    ).toBe("repository_plus_feed");
  });

  it("canary: forbidden vocabulary in a validated feed article is caught", () => {
    const canaryCatalog = buildPublicCatalog(
      feedArticle({
        slug: "signal-20260710-forbidden-canary",
        title: "crawler leak canary",
      }),
    );
    const { container } = renderFullPage(
      buildOverlayProps(canaryCatalog.articles),
    );

    expect(() => assertReaderVocabulary(container)).toThrow(/crawler/);
  });

  it("unknown feed slug: route resolution fails closed", async () => {
    const template = catalog.articles[0];
    const unknown: ArticleInflowPublicArticle = {
      ...template,
      articleId: "daily-intel-20260710-unknown",
      family: "daily-intel",
      titleJa: "Unknown catalog article",
      publishedAtJst: "2026-07-10T15:00:00+09:00",
      href: "/articles/daily-intel-20260710-unknown",
      source: "inflow",
    };
    const { container } = renderFullPage(
      buildOverlayProps([unknown, ...catalog.articles]),
    );
    const anchor = [
      ...container.querySelectorAll('a[href="/articles/daily-intel-20260710-unknown"]'),
    ][0];

    expect(anchor).not.toBeUndefined();
    await expect(
      expectResolvesPublicDocument(
        stripLocale(anchor.getAttribute("href")!),
      ),
    ).rejects.toThrow(/article not found in public catalog/);
  });
});
