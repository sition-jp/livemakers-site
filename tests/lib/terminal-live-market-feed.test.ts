import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TERMINAL_FEED_ENV_KEY,
  TERMINAL_FEED_REVALIDATE_SECONDS,
  TERMINAL_FEED_SCHEMA_V01,
  TERMINAL_FEED_SCHEMA_V02,
  TERMINAL_FEED_SCHEMA_V03,
  TERMINAL_FEED_SCHEMA_V04,
  fetchLiveMarketData,
  formatAsOfLabel,
  mapTerminalFeed,
} from "@/lib/terminal/live-market-feed";
import { marketLanesFixture } from "@/lib/terminal/market-lanes";

const HOME_V02_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(
      process.cwd(),
      "tests/fixtures/terminal/terminal_feed_v0.2.home.sample.json",
    ),
    "utf8",
  ),
) as Record<string, any>;

function sampleHomeV02(): Record<string, any> {
  return structuredClone(HOME_V02_FIXTURE);
}

const HOME_V03_FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(
      process.cwd(),
      "tests/fixtures/terminal/terminal_feed_v0.3.home.sample.json",
    ),
    "utf8",
  ),
) as Record<string, any>;

function sampleHomeV03(): Record<string, any> {
  return structuredClone(HOME_V03_FIXTURE);
}

function sampleHomeV04(): Record<string, any> {
  const feed = sampleHomeV03();
  feed.schema_version = TERMINAL_FEED_SCHEMA_V04;
  feed.sessions.records[0].editorial = {
    digestId: "dig_20260712_0730_ab12cd34",
    crawlAnchorJst: "2026-07-12T05:03:00+09:00",
    writtenAtJst: "2026-07-12T07:12:00+09:00",
    lead: "市場は政策発言を受けて方向感を探っている。一次情報では次の判断材料が示された。",
    items: [
      {
        headline: "一次情報で確認された主要な動き",
        note: "発表主体は次の対応方針を示した。",
        sourceUrl: "https://primary.example.org/news/123",
      },
    ],
    watch: ["次の公式発表で時期と対象範囲を確認する。"],
  };
  return feed;
}

/** Mirrors what the SDE-side generator (livemakers_export) emits. */
function sampleFeed() {
  return {
    schema_version: "livemakers_terminal_feed_v0.1",
    feed_id: "sde_local.terminal_feed.2026_07_04",
    generated_at: "2026-07-04T13:40:08+09:00",
    source_mode: "sde_local_projection",
    delivery: "vercel_blob",
    windows: {
      liveRadar: { title: { en: "Radar", ja: "Radar" }, badge: "SESSION", asOf: null, items: [] },
      macroLane: {
        key: "macro",
        badge: "SNAPSHOT",
        tiles: [
          {
            id: "macro.dxy",
            label: "DXY",
            value: "100.86",
            deltaPct: -0.0,
            note: { en: "US dollar index", ja: "米ドル指数" },
            asOf: "2026-07-04T07:30:00+09:00",
            badge: "SNAPSHOT",
          },
          {
            id: "macro.us10y",
            label: "US10Y",
            value: "4.47%",
            note: { en: "10-year Treasury yield (FRED GS10, monthly)", ja: "米10年金利(FRED GS10・月次)" },
            asOf: "2026-06-01",
            badge: "SNAPSHOT",
          },
        ],
      },
      cryptoLane: {
        key: "crypto",
        badge: "SNAPSHOT",
        tiles: [
          {
            id: "crypto.btc",
            label: "BTC / USD",
            value: "$62,579",
            deltaPct: 1.83,
            note: { en: "Bitcoin", ja: "ビットコイン" },
            asOf: "2026-07-04T07:30:00+09:00",
            badge: "SNAPSHOT",
          },
          {
            id: "crypto.total",
            label: "TOTAL MCAP",
            value: null,
            note: { en: "Awaiting data source", ja: "データソース準備中" },
            asOf: null,
            badge: "SNAPSHOT",
          },
        ],
      },
      rwaLane: { key: "rwa", badge: "SNAPSHOT", tiles: [] },
      published: { title: { en: "Published Intelligence", ja: "公開済インテリジェンス" }, items: [] },
      scheduledSession: { lastCompletedAt: null, nextScheduledAt: null },
    },
    ticker: [
      {
        id: "ticker.dxy",
        label: "DXY",
        value: "100.86",
        deltaPct: -0.0,
        asOf: "2026-07-04T07:30:00+09:00",
        badge: "SNAPSHOT",
      },
      {
        id: "ticker.btc",
        label: "BTC",
        value: "$62,579",
        deltaPct: 1.83,
        asOf: "2026-07-04T07:30:00+09:00",
        badge: "SNAPSHOT",
      },
    ],
  };
}

describe("mapTerminalFeed", () => {
  it("maps macro/crypto lanes and keeps RWA on the reviewed fixture", () => {
    const data = mapTerminalFeed(sampleFeed());
    expect(data).not.toBeNull();
    expect(data?.lanes.map((lane) => lane.key)).toEqual(["macro", "crypto", "rwa"]);
    expect(data?.lanes[0].badge).toBe("SNAPSHOT");
    expect(data?.lanes[0].tiles[0]).toMatchObject({
      id: "macro.dxy",
      value: "100.86",
      badge: "SNAPSHOT",
      asOfLabel: "2026-07-04 07:30 JST",
    });
    // GS10 is a dated series — the label passes the bare date through
    expect(data?.lanes[0].tiles[1].asOfLabel).toBe("2026-06-01");
    // unavailable_not_zero survives the mapping
    expect(data?.lanes[1].tiles[1].value).toBeNull();
    // RWA window is the fixture object (B5 not landed)
    expect(data?.lanes[2]).toBe(marketLanesFixture.find((lane) => lane.key === "rwa"));
    expect(data?.ticker.map((item) => item.id)).toEqual(["ticker.dxy", "ticker.btc"]);
    expect(data?.ticker[0].badge).toBe("SNAPSHOT");
  });

  it("rejects a payload with the wrong schema_version", () => {
    const feed = sampleFeed();
    feed.schema_version = "livemakers_terminal_feed_v9";
    expect(mapTerminalFeed(feed)).toBeNull();
  });

  it("rejects tiles carrying keys outside the contract (whitelist posture)", () => {
    const feed = sampleFeed();
    (feed.windows.macroLane.tiles[0] as Record<string, unknown>).rank_reason = "tier1";
    expect(mapTerminalFeed(feed)).toBeNull();
  });

  it("rejects non-string tile values (unavailable must be null, not 0)", () => {
    const feed = sampleFeed();
    (feed.windows.macroLane.tiles[0] as Record<string, unknown>).value = 0;
    expect(mapTerminalFeed(feed)).toBeNull();
  });

  it("rejects unknown badges", () => {
    const feed = sampleFeed();
    (feed.windows.macroLane.tiles[0] as Record<string, unknown>).badge = "LIVE";
    expect(mapTerminalFeed(feed)).toBeNull();
  });

  it("rejects swapped lane keys", () => {
    const feed = sampleFeed();
    feed.windows.macroLane.key = "crypto";
    expect(mapTerminalFeed(feed)).toBeNull();
  });
});

describe("formatAsOfLabel", () => {
  it("formats ISO datetimes compactly and passes bare dates through", () => {
    expect(formatAsOfLabel("2026-07-04T07:30:00+09:00")).toBe("2026-07-04 07:30 JST");
    expect(formatAsOfLabel("2026-06-01")).toBe("2026-06-01");
    expect(formatAsOfLabel(null)).toBeUndefined();
    expect(formatAsOfLabel("not a date")).toBeUndefined();
  });
});

describe("fetchLiveMarketData", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns null when the feed URL env is unset (fixture fallback)", async () => {
    vi.stubEnv(TERMINAL_FEED_ENV_KEY, "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchLiveMarketData()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(TERMINAL_FEED_REVALIDATE_SECONDS).toBe(3600);
  });

  it("returns mapped data for a valid delivered payload", async () => {
    vi.stubEnv(TERMINAL_FEED_ENV_KEY, "https://example.public.blob.vercel-storage.com/feed.json");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => sampleFeed() })),
    );
    const data = await fetchLiveMarketData();
    expect(data?.lanes).toHaveLength(3);
  });

  it("returns null on HTTP errors and on fetch failures", async () => {
    vi.stubEnv(TERMINAL_FEED_ENV_KEY, "https://example.public.blob.vercel-storage.com/feed.json");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await fetchLiveMarketData()).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await fetchLiveMarketData()).toBeNull();
  });
});

describe("mapTerminalFeed — v0.2 reviewed home bundle (G43)", () => {
  it("maps the exact 18 cells and focus-session series", () => {
    const data = mapTerminalFeed(sampleHomeV02());
    expect(data).not.toBeNull();
    expect(data?.home?.pagePacketId).toBe("lmk_20260712_0730_a1");
    expect(data?.home?.marketPacketId).toBe("mkt12_20260712_am");
    expect(data?.home?.cells).toHaveLength(18);
    expect(data?.home?.focusSession.focusInstruments).toEqual([
      "btc_usd",
      "usd_jpy",
    ]);
    expect(data?.home?.focusSession.series).toHaveLength(2);
    expect(data?.home?.focusSession.series[0]).toMatchObject({
      instrumentId: "btc_usd",
      seriesPacketId: "series.2026-07-12.btc_usd",
      baseValue: 61520,
      lastValue: 63299,
      sourceMode: "reviewed_live",
      reviewStatus: "reviewed_snapshot",
    });
    expect(data?.home?.provenance).toEqual({
      sourceMode: "reviewed_live",
      reviewStatus: "reviewed_snapshot",
    });
  });

  it("keeps v0.1 market data compatible while exposing no reviewed home", () => {
    const data = mapTerminalFeed(sampleFeed());
    expect(data).not.toBeNull();
    expect(data?.home).toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.86");
  });

  it.each([
    ["asia", "05:03", "05:10"],
    ["am", "07:30", "07:37"],
    ["europe", "12:03", "12:10"],
    ["ny", "18:03", "18:10"],
    ["close", "23:03", "23:10"],
  ])("accepts %s completion through +7 minutes", (suffix, anchor, boundary) => {
    const feed = sampleHomeV02();
    const date = feed.home.dataDate.replaceAll("-", "");
    feed.home.asOfJst = `${feed.home.dataDate}T${boundary}:00+09:00`;
    feed.home.pagePacketId = `lmk_${date}_${boundary.replace(":", "")}_a1`;
    feed.home.marketPacketId = `mkt12_${date}_${suffix}`;
    for (const series of feed.home.focusSession.series) {
      series.points[0].atJst = `${feed.home.dataDate}T${anchor}:00+09:00`;
      series.points.at(-1).atJst = feed.home.asOfJst;
    }

    expect(mapTerminalFeed(feed)?.home).not.toBeNull();
  });

  it("rejects completion after the +7 minute boundary", () => {
    const feed = sampleHomeV02();
    feed.home.asOfJst = `${feed.home.dataDate}T07:37:01+09:00`;
    feed.home.pagePacketId = "lmk_20260712_0737_a1";
    for (const series of feed.home.focusSession.series) {
      series.points.at(-1).atJst = feed.home.asOfJst;
    }

    expect(mapTerminalFeed(feed)?.home).toBeNull();
  });

  it("rejects a page packet HHmm that differs from home asOfJst", () => {
    const feed = sampleHomeV02();
    feed.home.pagePacketId = "lmk_20260712_0731_a1";

    expect(mapTerminalFeed(feed)?.home).toBeNull();
  });

  it("rejects a semantic suffix that differs from the completion anchor", () => {
    const feed = sampleHomeV02();
    feed.home.asOfJst = `${feed.home.dataDate}T05:10:00+09:00`;
    feed.home.pagePacketId = "lmk_20260712_0510_a1";
    for (const series of feed.home.focusSession.series) {
      series.points[0].atJst = `${feed.home.dataDate}T05:03:00+09:00`;
      series.points.at(-1).atJst = feed.home.asOfJst;
    }

    expect(mapTerminalFeed(feed)?.home).toBeNull();
  });

  it.each([
    [
      "legacy night identity",
      (feed: Record<string, any>) => {
        feed.home.cells[3].instrumentId = "night_usdt";
        feed.home.cells[3].nameJa = "NIGHT/USDT";
      },
    ],
    [
      "legacy boolean direction",
      (feed: Record<string, any>) => {
        delete feed.home.cells[0].direction;
        feed.home.cells[0].up = true;
      },
    ],
    [
      "partial-null direction",
      (feed: Record<string, any>) => {
        feed.home.cells[0].direction = null;
      },
    ],
  ])("rejects %s", (_label, mutate) => {
    const feed = sampleHomeV02();
    mutate(feed);

    expect(mapTerminalFeed(feed)?.home).toBeNull();
  });

  it.each([
    ["missing cell", (feed: Record<string, any>) => feed.home.cells.pop()],
    [
      "duplicate cell",
      (feed: Record<string, any>) =>
        feed.home.cells.push(structuredClone(feed.home.cells[0])),
    ],
    [
      "RWA cell",
      (feed: Record<string, any>) => {
        feed.home.cells[17].instrumentId = "rwa_tvl";
        feed.home.cells[17].nameJa = "RWA TVL";
      },
    ],
    [
      "packet date mismatch",
      (feed: Record<string, any>) => {
        feed.home.pagePacketId = "lmk_20260711_0730_a1";
      },
    ],
    [
      "invalid page packet suffix",
      (feed: Record<string, any>) => {
        feed.home.pagePacketId = "lmk_20260712_0730_A1";
      },
    ],
    [
      "cross provenance pair",
      (feed: Record<string, any>) => {
        feed.home.reviewStatus = "reviewed_fixture";
      },
    ],
    [
      "display-name mismatch",
      (feed: Record<string, any>) => {
        feed.home.cells[0].nameJa = "Bitcoin";
      },
    ],
    [
      "focus set mismatch",
      (feed: Record<string, any>) => {
        feed.home.focusSession.focusInstruments[1] = "gold";
      },
    ],
    [
      "focus session date mismatch",
      (feed: Record<string, any>) => {
        feed.home.focusSession.sessionDate = "2026-07-11";
      },
    ],
    [
      "unknown focus session slug",
      (feed: Record<string, any>) => {
        feed.home.focusSession.sessionSlug = "tokyo-close";
      },
    ],
    [
      "one-point series",
      (feed: Record<string, any>) => {
        feed.home.focusSession.series[0].points = [
          feed.home.focusSession.series[0].points[0],
        ];
      },
    ],
    [
      "future point",
      (feed: Record<string, any>) => {
        feed.home.focusSession.series[0].points[1].atJst =
          "2026-07-12T08:00:00+09:00";
      },
    ],
    [
      "duplicate point timestamp",
      (feed: Record<string, any>) => {
        feed.home.focusSession.series[0].points[1].atJst =
          feed.home.focusSession.series[0].points[0].atJst;
      },
    ],
    [
      "reverse-ordered points",
      (feed: Record<string, any>) => {
        feed.home.focusSession.series[0].points.reverse();
      },
    ],
    [
      "point older than 24 hours",
      (feed: Record<string, any>) => {
        feed.home.focusSession.series[0].points[0].atJst =
          "2026-07-11T07:29:59+09:00";
      },
    ],
    [
      "seven-point series",
      (feed: Record<string, any>) => {
        feed.home.focusSession.series[0].points = Array.from(
          { length: 7 },
          (_, index) => ({
            atJst: `2026-07-12T0${index + 1}:30:00+09:00`,
            value: 62000 + index,
          }),
        );
      },
    ],
    [
      "unknown home key",
      (feed: Record<string, any>) => {
        feed.home.internalPath = "/Users/operator/raw.jsonl";
      },
    ],
    [
      "unknown cell key",
      (feed: Record<string, any>) => {
        feed.home.cells[0].rawSource = "internal";
      },
    ],
    [
      "unknown point key",
      (feed: Record<string, any>) => {
        feed.home.focusSession.series[0].points[0].interpolated = true;
      },
    ],
    [
      "empty rendered cell value",
      (feed: Record<string, any>) => {
        feed.home.cells[0].value = "";
      },
    ],
  ])("degrades only home for %s", (_label, mutate) => {
    const feed = sampleHomeV02();
    mutate(feed);
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.home).toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.94");
  });
});

/** G39-B B3: live radar window mapping (PR #13 validator gated). */
function sampleRadarWindow() {
  return {
    title: { en: "Radar", ja: "Radar" },
    badge: "SESSION",
    asOf: "2026-07-04T18:20:41+09:00",
    items: [
      {
        id: "radar.a1",
        sourceLane: "x_news_trends",
        sourceLabel: { en: "X", ja: "X" },
        family: "market_news",
        title: {
          en: "Treasury tightens stablecoin oversight",
          ja: "Treasury tightens stablecoin oversight",
        },
        status: "breaking",
        freshnessLabel: { en: "as of 18:05 JST", ja: "18:05 JST 時点" },
        displayMode: "title_only",
        publishDecision: "not_authorized",
        href: null,
      },
      {
        id: "radar.b2",
        sourceLane: "sde_phase1_breaking_radar",
        sourceLabel: { en: "handelsblatt.com", ja: "handelsblatt.com" },
        family: "market_news",
        title: {
          en: "Banken: N26 beendet kostenlosen Wertpapierhandel",
          ja: "Banken: N26 beendet kostenlosen Wertpapierhandel",
        },
        status: "sde_review_pending",
        freshnessLabel: { en: "time unconfirmed", ja: "時刻未確認" },
        displayMode: "title_only",
        publishDecision: "not_authorized",
        href: null,
      },
    ],
  };
}

describe("mapTerminalFeed — live radar (B3)", () => {
  it("maps the radar window when both lanes are present and the PR #13 validator passes", () => {
    const feed = sampleFeed();
    feed.windows.liveRadar = sampleRadarWindow() as never;
    const data = mapTerminalFeed(feed);
    expect(data?.liveRadar).not.toBeNull();
    expect(data?.liveRadar?.items).toHaveLength(2);
    expect(data?.liveRadar?.badge).toBe("SESSION");
    expect(data?.liveRadar?.asOfLabel).toBe("2026-07-04 18:20 JST");
  });

  it("degrades radar to null when a required lane is missing — market lanes stay live", () => {
    const feed = sampleFeed();
    const radar = sampleRadarWindow();
    radar.items = radar.items.filter(
      (item) => item.sourceLane !== "sde_phase1_breaking_radar",
    );
    feed.windows.liveRadar = radar as never;
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.liveRadar).toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.86");
  });

  it("degrades radar to null when an item carries a link (non-clickable contract)", () => {
    const feed = sampleFeed();
    const radar = sampleRadarWindow();
    (radar.items[0] as { href: unknown }).href = "https://example.com";
    feed.windows.liveRadar = radar as never;
    expect(mapTerminalFeed(feed)?.liveRadar).toBeNull();
  });

  it("degrades radar to null when a title leaks a URL (forbidden visible text)", () => {
    const feed = sampleFeed();
    const radar = sampleRadarWindow();
    radar.items[0].title.en = "See https://t.co/abc for the market details";
    feed.windows.liveRadar = radar as never;
    expect(mapTerminalFeed(feed)?.liveRadar).toBeNull();
  });

  it("degrades radar to null when an item carries a forbidden payload key", () => {
    const feed = sampleFeed();
    const radar = sampleRadarWindow();
    (radar.items[0] as Record<string, unknown>).body = "full text";
    feed.windows.liveRadar = radar as never;
    expect(mapTerminalFeed(feed)?.liveRadar).toBeNull();
  });

  it("degrades radar to null when the empty placeholder window arrives", () => {
    // sampleFeed ships liveRadar with items: [] (pre-B3 placeholder)
    const data = mapTerminalFeed(sampleFeed());
    expect(data).not.toBeNull();
    expect(data?.liveRadar).toBeNull();
  });

  it("maps scheduled session times and tolerates nulls", () => {
    const feed = sampleFeed();
    feed.windows.scheduledSession = {
      lastCompletedAt: "2026-07-04T18:20:41+09:00",
      nextScheduledAt: "2026-07-04T22:33:00+09:00",
    } as never;
    const data = mapTerminalFeed(feed);
    expect(data?.scheduledSession?.lastCompletedLabel).toBe(
      "2026-07-04 18:20 JST",
    );
    expect(data?.scheduledSession?.nextScheduledLabel).toBe(
      "2026-07-04 22:33 JST",
    );

    const nulls = mapTerminalFeed(sampleFeed());
    expect(nulls?.scheduledSession).toBeNull();
  });
});

function samplePublishedWindow() {
  return {
    title: { en: "Published Intelligence", ja: "公開済インテリジェンス" },
    items: [
      {
        account: "SIPO_Tokyo",
        date: "2026-07-04",
        title: "エポックな日々：640",
        type: "epoch_report",
        url: "https://x.com/SIPO_Tokyo/status/2073312137804702076",
      },
      {
        account: "SITIONjp",
        date: "2026-07-03",
        title: "Daily Intel headline",
        type: "daily_intel",
        url: "https://x.com/SITIONjp/status/2072900000000000000",
      },
    ],
  };
}

describe("mapTerminalFeed — published X feed (B4)", () => {
  it("maps the published window when every item passes the url allowlist", () => {
    const feed = sampleFeed();
    feed.windows.published = samplePublishedWindow() as never;
    const data = mapTerminalFeed(feed);
    expect(data?.published).not.toBeNull();
    expect(data?.published?.items).toHaveLength(2);
    expect(data?.published?.items[0].account).toBe("SIPO_Tokyo");
    expect(data?.published?.items[0].url).toContain("x.com/SIPO_Tokyo");
  });

  it("returns null for the empty placeholder window (no empty secondary heading)", () => {
    const data = mapTerminalFeed(sampleFeed());
    expect(data).not.toBeNull();
    expect(data?.published).toBeNull();
  });

  it("degrades the whole section to null when any url is off the host allowlist", () => {
    const feed = sampleFeed();
    const published = samplePublishedWindow();
    published.items[1].url = "https://evil.example.com/phish";
    feed.windows.published = published as never;
    expect(mapTerminalFeed(feed)?.published).toBeNull();
  });

  it("rejects non-https urls (no javascript: or http: external surface)", () => {
    const feed = sampleFeed();
    const published = samplePublishedWindow();
    published.items[0].url = "http://x.com/SIPO_Tokyo/status/1";
    feed.windows.published = published as never;
    expect(mapTerminalFeed(feed)?.published).toBeNull();

    const feed2 = sampleFeed();
    const published2 = samplePublishedWindow();
    // eslint-disable-next-line no-script-url
    published2.items[0].url = "javascript:alert(1)";
    feed2.windows.published = published2 as never;
    expect(mapTerminalFeed(feed2)?.published).toBeNull();
  });

  it("degrades to null when a published item carries a key outside the whitelist", () => {
    const feed = sampleFeed();
    const published = samplePublishedWindow();
    (published.items[0] as Record<string, unknown>).body = "full X thread text";
    feed.windows.published = published as never;
    expect(mapTerminalFeed(feed)?.published).toBeNull();
  });

  it("keeps market lanes live even when the published section is malformed", () => {
    const feed = sampleFeed();
    const published = samplePublishedWindow();
    published.items[0].url = "not-a-url";
    feed.windows.published = published as never;
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.published).toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.86");
  });
});

function sampleRwaLane() {
  return {
    key: "rwa",
    badge: "SNAPSHOT",
    tiles: [
      {
        id: "rwa.tvl",
        label: "RWA TVL",
        value: "$25.3B",
        note: { en: "On-chain RWA total value locked (DefiLlama)", ja: "オンチェーンRWA総額(DefiLlama)" },
        asOf: "2026-07-05T01:45:00+09:00",
        badge: "SNAPSHOT",
      },
      {
        id: "rwa.stocks",
        label: "TOKENIZED STOCKS",
        value: null,
        note: { en: "Awaiting data source selection", ja: "データソース選定待ち" },
        asOf: null,
        badge: "SNAPSHOT",
      },
    ],
  };
}

describe("mapTerminalFeed — RWA lane (B5)", () => {
  it("maps the delivered RWA lane (TVL live, stocks unavailable)", () => {
    const feed = sampleFeed();
    feed.windows.rwaLane = sampleRwaLane() as never;
    const data = mapTerminalFeed(feed);
    const rwa = data?.lanes.find((lane) => lane.key === "rwa");
    const tiles = Object.fromEntries((rwa?.tiles ?? []).map((t) => [t.id, t]));
    expect(tiles["rwa.tvl"].value).toBe("$25.3B");
    expect(tiles["rwa.tvl"].asOfLabel).toBe("2026-07-05 01:45 JST");
    expect(tiles["rwa.stocks"].value).toBeNull();
  });

  it("falls back to the reviewed RWA fixture when the lane is invalid", () => {
    const feed = sampleFeed();
    // sampleFeed ships rwaLane with tiles: [] (fails laneSchema min(1))
    const data = mapTerminalFeed(feed);
    const rwa = data?.lanes.find((lane) => lane.key === "rwa");
    const fixtureRwa = marketLanesFixture.find((lane) => lane.key === "rwa");
    expect(rwa).toEqual(fixtureRwa);
    // macro/crypto stay live regardless
    expect(data?.lanes[0].tiles[0].value).toBe("100.86");
  });

  it("keeps macro/crypto live when the RWA section has a bad tile", () => {
    const feed = sampleFeed();
    const rwa = sampleRwaLane();
    (rwa.tiles[0] as Record<string, unknown>).extraKey = "nope";
    feed.windows.rwaLane = rwa as never;
    const data = mapTerminalFeed(feed);
    const rwaLane = data?.lanes.find((lane) => lane.key === "rwa");
    const fixtureRwa = marketLanesFixture.find((lane) => lane.key === "rwa");
    expect(rwaLane).toEqual(fixtureRwa);
    expect(data?.lanes[1].tiles[0].value).toBe("$62,579");
  });
});

function sampleSourceWindow() {
  return {
    title: { en: "Source", ja: "一次ソース" },
    badge: "SESSION",
    asOf: "2026-07-05T05:03:00+09:00",
    items: [
      {
        id: "source.alpha",
        title: {
          en: "Treasury liquidity stress draws renewed market attention",
          ja: "Treasury liquidity stress draws renewed market attention",
        },
        sourceDomain: "reuters.com",
        category: { en: "Macro", ja: "マクロ" },
        freshnessLabel: { en: "as of 04:55 JST", ja: "04:55 JST 時点" },
      },
      {
        id: "source.beta",
        title: {
          en: "Stablecoin reserve bill advances through committee review",
          ja: "Stablecoin reserve bill advances through committee review",
        },
        sourceDomain: "x.com",
        category: { en: "Crypto", ja: "暗号資産" },
        freshnessLabel: { en: "as of 04:40 JST", ja: "04:40 JST 時点" },
      },
    ],
  };
}

describe("mapTerminalFeed — source window (Plan B)", () => {
  it("maps the SDE Plan A source window as a non-click feed", () => {
    const feed = sampleFeed();
    (feed.windows as Record<string, unknown>).source = sampleSourceWindow();
    const data = mapTerminalFeed(feed);

    expect(data?.source).not.toBeNull();
    expect(data?.source?.title.en).toBe("Source");
    expect(data?.source?.badge).toBe("SESSION");
    expect(data?.source?.asOfLabel).toBe("2026-07-05 05:03 JST");
    expect(data?.source?.items[0]).toMatchObject({
      id: "source.alpha",
      sourceDomain: "reuters.com",
      category: { en: "Macro", ja: "マクロ" },
    });
    expect(Object.keys(data?.source?.items[0] ?? {}).sort()).toEqual([
      "category",
      "freshnessLabel",
      "id",
      "sourceDomain",
      "title",
    ]);
  });

  it("returns null for missing or empty source windows", () => {
    expect(mapTerminalFeed(sampleFeed())?.source).toBeNull();

    const feed = sampleFeed();
    (feed.windows as Record<string, unknown>).source = {
      ...sampleSourceWindow(),
      items: [],
    };
    expect(mapTerminalFeed(feed)?.source).toBeNull();
  });

  it("degrades source to null when any item carries url or href keys", () => {
    const feed = sampleFeed();
    const source = sampleSourceWindow();
    (source.items[0] as Record<string, unknown>).url = "https://x.com/a";
    (feed.windows as Record<string, unknown>).source = source;

    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.source).toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.86");

    const feed2 = sampleFeed();
    const source2 = sampleSourceWindow();
    (source2.items[0] as Record<string, unknown>).href = "/brief/2026-W27-brief";
    (feed2.windows as Record<string, unknown>).source = source2;
    expect(mapTerminalFeed(feed2)?.source).toBeNull();
  });

  it("degrades source to null when titles leak URL patterns, handles, or ops terms", () => {
    const cases = [
      "Market desks are watching bit.ly/abc today",
      "Markets reacted to @macro_guru overnight",
      "Source Queue retention moved the market narrative",
    ];

    for (const title of cases) {
      const feed = sampleFeed();
      const source = sampleSourceWindow();
      source.items[0].title.en = title;
      (feed.windows as Record<string, unknown>).source = source;
      expect(mapTerminalFeed(feed)?.source).toBeNull();
    }
  });

  it("degrades source to null when sourceDomain is not a bare host", () => {
    const feed = sampleFeed();
    const source = sampleSourceWindow();
    source.items[0].sourceDomain = "reuters.com/markets";
    (feed.windows as Record<string, unknown>).source = source;
    expect(mapTerminalFeed(feed)?.source).toBeNull();
  });
});

describe("schema_version enum (G43-d T1)", () => {
  it("names the three accepted schema versions", () => {
    expect(TERMINAL_FEED_SCHEMA_V01).toBe("livemakers_terminal_feed_v0.1");
    expect(TERMINAL_FEED_SCHEMA_V02).toBe("livemakers_terminal_feed_v0.2");
    expect(TERMINAL_FEED_SCHEMA_V03).toBe("livemakers_terminal_feed_v0.3");
  });

  it("still maps a v0.1 payload (non-breaking)", () => {
    expect(mapTerminalFeed(sampleFeed())).not.toBeNull();
  });

  it("still maps a v0.2 payload with full home functionality (non-breaking)", () => {
    const data = mapTerminalFeed(sampleHomeV02());
    expect(data).not.toBeNull();
    expect(data?.home).not.toBeNull();
    expect(data?.radar).toBeNull();
  });

  it("maps a v0.3 payload with both home and radar (superset of v0.2)", () => {
    const data = mapTerminalFeed(sampleHomeV03());
    expect(data).not.toBeNull();
    expect(data?.home).not.toBeNull();
    expect(data?.home?.pagePacketId).toBe("lmk_20260712_0730_a1");
    expect(data?.radar).not.toBeNull();
  });
});

/** G43-d T2/T3: the feed `radar` bundle (site-consumer side of the contract). */
describe("mapTerminalFeed — radar bundle (G43-d)", () => {
  it("maps observations and promotions from a valid v0.3 radar bundle", () => {
    const data = mapTerminalFeed(sampleHomeV03());
    expect(data?.radar).not.toBeNull();
    expect(data?.radar?.observations).toHaveLength(2);
    expect(data?.radar?.observations[0]).toEqual({
      topicId: "stablecoin_supply_20260712",
      lane: "sde_phase1_breaking_radar",
      titleJa: "ステーブルコイン供給の週次増分が再加速",
      observedAtLabel: "05:12",
      observedAtJst: "2026-07-12T05:12:00+09:00",
      href: null,
      displayMode: "title_only",
      publishDecision: "not_authorized",
    });
    expect(data?.radar?.promotions).toEqual({});
  });

  it("never reads radar off a v0.1 or v0.2 payload, even if the key is present", () => {
    const feedV1 = sampleFeed() as Record<string, unknown>;
    feedV1.radar = sampleHomeV03().radar;
    expect(mapTerminalFeed(feedV1)?.radar).toBeNull();

    const feedV2 = sampleHomeV02();
    feedV2.radar = sampleHomeV03().radar;
    expect(mapTerminalFeed(feedV2)?.radar).toBeNull();
    // v0.2 home stays fully mapped regardless.
    expect(mapTerminalFeed(feedV2)?.home).not.toBeNull();
  });

  it("degrades radar to null on a bad schemaVersion literal — market lanes and home stay live", () => {
    const feed = sampleHomeV03();
    feed.radar.schemaVersion = "livemakers_radar_v2";
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.radar).toBeNull();
    expect(data?.home).not.toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.94");
  });

  it("degrades radar to null on a malformed packetId", () => {
    const feed = sampleHomeV03();
    feed.radar.packetId = "not-a-packet-id";
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("degrades radar to null when asOfJst is not a JST ISO string", () => {
    const feed = sampleHomeV03();
    feed.radar.asOfJst = "2026-07-12 07:30";
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("degrades radar to null when an observation carries a non-null href", () => {
    const feed = sampleHomeV03();
    feed.radar.observations[0].href = "https://example.com";
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("degrades radar to null when an observation carries a forbidden payload key", () => {
    const feed = sampleHomeV03();
    (feed.radar.observations[0] as Record<string, unknown>).body = "full text";
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("degrades radar to null when an observation is missing observedAtJst", () => {
    const feed = sampleHomeV03();
    delete feed.radar.observations[0].observedAtJst;
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("degrades radar to null when an observation carries an unknown lane", () => {
    const feed = sampleHomeV03();
    feed.radar.observations[0].lane = "unknown_lane";
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("degrades radar to null on a duplicate observation topicId — feed stays live (fix round 1)", () => {
    const feed = sampleHomeV03();
    feed.radar.observations[1].topicId = feed.radar.observations[0].topicId;
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.radar).toBeNull();
    // independent degradation: home and market lanes stay live.
    expect(data?.home).not.toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.94");
  });

  it("degrades radar to null when promotions carries a non-string value", () => {
    const feed = sampleHomeV03();
    feed.radar.promotions = { topic_a: 123 };
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("degrades radar to null when the bundle carries an extra top-level key", () => {
    const feed = sampleHomeV03();
    feed.radar.extra = "nope";
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("accepts an empty observations array as a valid (quiet) radar bundle", () => {
    const feed = sampleHomeV03();
    feed.radar.observations = [];
    const data = mapTerminalFeed(feed);
    expect(data?.radar).not.toBeNull();
    expect(data?.radar?.observations).toEqual([]);
  });

  it("degrades the whole radar bundle to null when a single title leaks forbidden visible text (fail-closed)", () => {
    const feed = sampleHomeV03();
    feed.radar.observations[0].titleJa = "published_log の更新を検出";
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.radar).toBeNull();
    // independent degradation: the rest of the feed stays live.
    expect(data?.home).not.toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.94");
  });

  it("degrades the whole radar bundle to null when a single title leaks an internal ops term", () => {
    const feed = sampleHomeV03();
    feed.radar.observations[1].titleJa = "crawler が拾った話題を確認中";
    expect(mapTerminalFeed(feed)?.radar).toBeNull();
  });

  it("keeps forbidden-term scanning word-boundary aware (no false positive)", () => {
    // "一次ソース検証" legitimately contains no forbidden substrings once
    // word-boundary matching is applied — mirrors the existing
    // assertRadarObservationContract / findForbiddenOpsTerms behaviour.
    const feed = sampleHomeV03();
    feed.radar.observations[0].titleJa = "一次ソース検証を経た話題を観測中";
    const data = mapTerminalFeed(feed);
    expect(data?.radar).not.toBeNull();
  });
});

/** G43-e S2: the feed `sessions` bundle (site-consumer side of the contract). */
function sampleSessionsBundle() {
  return {
    schemaVersion: "livemakers_sessions_v1",
    packetId: "sess_20260712_0730_ab12cd34",
    asOfJst: "2026-07-12T07:30:00+09:00",
    records: [
      {
        sessionId: "2026-07-12-asia-open",
        date: "2026-07-12",
        sessionSlug: "asia-open",
        liveStatus: "live",
        articleStatus: "pending",
        currentUrl: "/sessions/2026-07-12-asia-open",
        canonicalArticleUrl: null,
        publishedAt: null,
        publishLogId: null,
        packetId: "sess_20260712_asia",
        asOfJst: "2026-07-12T07:30:00+09:00",
        focusInstruments: ["btc_usd", "usd_jpy"],
        titleJa: "Asia Open Terminal",
        bullets: [
          "フィード経由で観測されたアジア時間の初動",
          "BTCとドル円の値動きを軸に整理",
        ],
      },
    ],
  };
}

describe("mapTerminalFeed — sessions bundle (G43-e S2)", () => {
  it("maps a valid v0.3 sessions bundle, reusing SessionMetaSchema verbatim", () => {
    const data = mapTerminalFeed(sampleHomeV03());
    expect(data?.sessions).not.toBeNull();
    expect(data?.sessions?.records).toHaveLength(1);
    expect(data?.sessions?.records[0]).toMatchObject({
      sessionId: "2026-07-12-asia-open",
      date: "2026-07-12",
      sessionSlug: "asia-open",
      liveStatus: "live",
      articleStatus: "pending",
      focusInstruments: ["btc_usd", "usd_jpy"],
    });
  });

  it("never reads sessions off a v0.1 or v0.2 payload, even if the key is present", () => {
    const feedV1 = sampleFeed() as Record<string, unknown>;
    feedV1.sessions = sampleSessionsBundle();
    expect(mapTerminalFeed(feedV1)?.sessions).toBeNull();

    const feedV2 = sampleHomeV02();
    feedV2.sessions = sampleSessionsBundle();
    const dataV2 = mapTerminalFeed(feedV2);
    expect(dataV2?.sessions).toBeNull();
    // v0.2 home stays fully mapped regardless.
    expect(dataV2?.home).not.toBeNull();
  });

  it("accepts an empty records array as a valid (quiet) sessions bundle", () => {
    const feed = sampleHomeV03();
    feed.sessions.records = [];
    const data = mapTerminalFeed(feed);
    expect(data?.sessions).not.toBeNull();
    expect(data?.sessions?.records).toEqual([]);
  });

  it("degrades sessions to null on a bad schemaVersion literal — market lanes and home stay live", () => {
    const feed = sampleHomeV03();
    feed.sessions.schemaVersion = "livemakers_sessions_v2";
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.sessions).toBeNull();
    expect(data?.home).not.toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.94");
  });

  it("degrades sessions to null on a malformed packetId", () => {
    const feed = sampleHomeV03();
    feed.sessions.packetId = "not-a-packet-id";
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it.each([
    ["headline", "Rank A で注目された公式発表"],
    ["note", "@非公式アカウントが確実だと断定した。"],
    ["watch", "私が必ず確認する。"],
  ])("applies the public-purity validator to editorial %s", (field, value) => {
    const feed = sampleHomeV04();
    if (field === "watch") {
      feed.sessions.records[0].editorial.watch[0] = value;
    } else {
      feed.sessions.records[0].editorial.items[0][field] = value;
    }
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("degrades sessions to null when asOfJst is not a JST ISO string", () => {
    const feed = sampleHomeV03();
    feed.sessions.asOfJst = "2026-07-12 07:30";
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("degrades sessions to null when records exceed the 4-record cap", () => {
    const feed = sampleHomeV03();
    const record = feed.sessions.records[0];
    feed.sessions.records = Array.from({ length: 5 }, () => ({ ...record }));
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("degrades sessions to null when a record fails the reused SessionMetaSchema itself", () => {
    const feed = sampleHomeV03();
    (feed.sessions.records[0] as Record<string, unknown>).extraKey = "nope";
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("degrades sessions to null when the bundle carries an extra top-level key", () => {
    const feed = sampleHomeV03();
    (feed.sessions as Record<string, unknown>).extra = "nope";
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("degrades the whole bundle to null when a record's date does not match the bundle asOfJst date", () => {
    const feed = sampleHomeV03();
    feed.sessions.records[0].date = "2026-07-11";
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.sessions).toBeNull();
    // independent degradation: home and market lanes stay live.
    expect(data?.home).not.toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.94");
  });

  it("degrades the whole bundle to null when a record's articleStatus is published (crystallize not yet wired)", () => {
    const feed = sampleHomeV03();
    feed.sessions.records[0] = {
      ...feed.sessions.records[0],
      liveStatus: "closed",
      articleStatus: "published",
      canonicalArticleUrl: feed.sessions.records[0].currentUrl,
      publishedAt: "2026-07-12T07:35:00+09:00",
    };
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.sessions).toBeNull();
    expect(data?.home).not.toBeNull();
  });

  // fix round 2 / I-1: same word-boundary forbidden-vocabulary + LIVE-token
  // scan mapRadarBundle applies to titleJa, extended to sessions' titleJa AND
  // every bullets[] entry — one violation anywhere nulls the whole bundle
  // (fail-closed), the rest of the feed stays live (independent degradation).
  it("degrades the whole bundle to null when a bullet leaks forbidden visible text (fail-closed, fix round 2 / I-1)", () => {
    const feed = sampleHomeV03();
    feed.sessions.records[0].bullets[0] = "published_log の更新を検出";
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.sessions).toBeNull();
    // independent degradation: home and market lanes stay live.
    expect(data?.home).not.toBeNull();
    expect(data?.lanes[0].tiles[0].value).toBe("100.94");
  });

  it("degrades the whole bundle to null when titleJa carries a bare LIVE token (fix round 2 / I-1)", () => {
    const feed = sampleHomeV03();
    feed.sessions.records[0].titleJa = "LIVE Asia Open Terminal";
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.sessions).toBeNull();
    expect(data?.home).not.toBeNull();
  });

  // fix round 2 / I-3: two additional fail-closed structural checks on the
  // records array itself (mirrors radarBundleSchema's duplicate-topicId
  // check), applied via superRefine so a violation degrades sessions to null
  // through the same safeParse-failure path as every other check above.
  it("degrades sessions to null when two records share the same sessionId (fix round 2 / I-3)", () => {
    const feed = sampleHomeV03();
    const record = feed.sessions.records[0];
    feed.sessions.records = [record, { ...record, liveStatus: "closed" }];
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.sessions).toBeNull();
    expect(data?.home).not.toBeNull();
  });

  it("degrades sessions to null when more than one record is live (fix round 2 / I-3)", () => {
    const feed = sampleHomeV03();
    const record = feed.sessions.records[0];
    feed.sessions.records = [
      record,
      {
        ...record,
        sessionId: "2026-07-12-europe-bridge",
        sessionSlug: "europe-bridge",
        currentUrl: "/sessions/2026-07-12-europe-bridge",
        packetId: "sess_20260712_europe",
      },
    ];
    const data = mapTerminalFeed(feed);
    expect(data).not.toBeNull();
    expect(data?.sessions).toBeNull();
    expect(data?.home).not.toBeNull();
  });
});

describe("feed sessions editorial v0.4 (P2-LVM-IT-G1 T4)", () => {
  it("accepts the strict optional editorial section only under v0.4", () => {
    const feed = sampleHomeV04();
    expect(mapTerminalFeed(feed)?.sessions?.records[0].editorial).toEqual(
      feed.sessions.records[0].editorial,
    );

    feed.schema_version = TERMINAL_FEED_SCHEMA_V03;
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("rejects v0.4 when no record carries editorial", () => {
    const feed = sampleHomeV04();
    delete feed.sessions.records[0].editorial;
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("accepts one previous-day global-close at 00:45 and 04:45", () => {
    for (const asOf of [
      "2026-07-13T00:45:00+09:00",
      "2026-07-13T04:45:00+09:00",
    ]) {
      const feed = sampleHomeV04();
      feed.sessions.asOfJst = asOf;
      feed.sessions.records[0] = {
        ...feed.sessions.records[0],
        sessionId: "2026-07-12-global-close",
        date: "2026-07-12",
        sessionSlug: "global-close",
        currentUrl: "/sessions/2026-07-12-global-close",
        packetId: "sess_20260712_global",
        asOfJst: "2026-07-12T23:03:00+09:00",
        editorial: {
          ...feed.sessions.records[0].editorial,
          crawlAnchorJst: "2026-07-12T23:03:00+09:00",
          writtenAtJst: "2026-07-13T00:05:00+09:00",
        },
      };
      expect(mapTerminalFeed(feed)?.sessions?.records).toHaveLength(1);
    }
  });

  it.each([
    ["05:03 expiry", "2026-07-13T05:03:00+09:00", "global-close", "2026-07-12"],
    ["previous non-global", "2026-07-13T04:45:00+09:00", "asia-open", "2026-07-12"],
    ["future record", "2026-07-12T23:45:00+09:00", "global-close", "2026-07-13"],
  ])("rejects the whole bundle for %s", (_label, bundleAsOf, slug, recordDate) => {
    const feed = sampleHomeV04();
    feed.sessions.asOfJst = bundleAsOf;
    feed.sessions.records[0] = {
      ...feed.sessions.records[0],
      sessionId: `${recordDate}-${slug}`,
      date: recordDate,
      sessionSlug: slug,
      currentUrl: `/sessions/${recordDate}-${slug}`,
      packetId: `sess_${recordDate.replaceAll("-", "")}_${slug.replaceAll("-", "")}`,
      editorial: {
        ...feed.sessions.records[0].editorial,
        crawlAnchorJst: `${recordDate}T${
          slug === "global-close" ? "23:03" : "05:03"
        }:00+09:00`,
        writtenAtJst:
          slug === "global-close"
            ? `${recordDate}T23:30:00+09:00`
            : `${recordDate}T07:12:00+09:00`,
      },
    };
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("rejects unknown editorial keys and unsafe editorial text fail-closed", () => {
    const unknown = sampleHomeV04();
    unknown.sessions.records[0].editorial.extra = "nope";
    expect(mapTerminalFeed(unknown)?.sessions).toBeNull();

    const unsafe = sampleHomeV04();
    unsafe.sessions.records[0].editorial.lead =
      "crawler の checkpoint を確認した。一次情報を整理した。";
    expect(mapTerminalFeed(unsafe)?.sessions).toBeNull();
  });

  it.each([
    "A層で注目された。公式発表で次の材料が示された。",
    "いいね 1000件を集めた。公式発表で次の材料が示された。",
    "私は現場で確認した。これは確実だ。",
    "黒幕が仕組んだ動きだ。絶対に相場が上がる。",
    "example.org/news を確認した。公式発表で次の材料が示された。",
  ])("rejects every prohibited editorial narrative category: %s", (lead) => {
    const feed = sampleHomeV04();
    feed.sessions.records[0].editorial.lead = lead;
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });

  it("rejects more than one previous-day global-close record", () => {
    const feed = sampleHomeV04();
    feed.sessions.asOfJst = "2026-07-13T04:45:00+09:00";
    const record = {
      ...feed.sessions.records[0],
      sessionId: "2026-07-12-global-close",
      date: "2026-07-12",
      sessionSlug: "global-close",
      currentUrl: "/sessions/2026-07-12-global-close",
      packetId: "sess_20260712_global",
      editorial: {
        ...feed.sessions.records[0].editorial,
        crawlAnchorJst: "2026-07-12T23:03:00+09:00",
        writtenAtJst: "2026-07-12T23:30:00+09:00",
      },
    };
    feed.sessions.records = [
      record,
      {
        ...record,
        sessionId: "2026-07-12-global-close-copy",
        currentUrl: "/sessions/2026-07-12-global-close-copy",
      },
    ];
    expect(mapTerminalFeed(feed)?.sessions).toBeNull();
  });
});
