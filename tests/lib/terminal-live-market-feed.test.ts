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
