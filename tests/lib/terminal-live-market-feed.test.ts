import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TERMINAL_FEED_ENV_KEY,
  fetchLiveMarketData,
  formatAsOfLabel,
  mapTerminalFeed,
} from "@/lib/terminal/live-market-feed";
import { marketLanesFixture } from "@/lib/terminal/market-lanes";

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
    expect(await fetchLiveMarketData()).toBeNull();
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
