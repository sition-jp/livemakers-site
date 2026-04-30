import { describe, it, expect } from "vitest";
import {
  computeStaleness,
  mergeLivePriceForDisplay,
  type LiveAssetEntry,
} from "@/lib/terminal/asset-live";
import type { Price } from "@/lib/terminal/asset-summary";

describe("computeStaleness", () => {
  const NOW = new Date("2026-04-30T12:00:00+09:00");

  it("returns 0 when updated_at == now", () => {
    expect(computeStaleness(NOW.toISOString(), NOW)).toBe(0);
  });

  it("returns positive seconds when updated_at is in the past", () => {
    const past = new Date(NOW.getTime() - 90_000); // 90s ago
    expect(computeStaleness(past.toISOString(), NOW)).toBe(90);
  });

  it("returns null when updated_at is null", () => {
    expect(computeStaleness(null, NOW)).toBeNull();
  });

  it("returns null when updated_at is undefined", () => {
    expect(computeStaleness(undefined, NOW)).toBeNull();
  });

  it("returns null when updated_at is empty string", () => {
    expect(computeStaleness("", NOW)).toBeNull();
  });

  it("returns null when updated_at is unparseable", () => {
    expect(computeStaleness("not-a-date", NOW)).toBeNull();
    expect(computeStaleness("2026-13-99T99:99:99Z", NOW)).toBeNull();
  });

  it("uses a fresh `new Date()` when no `now` argument provided", () => {
    // Just sanity-check the default-arg path runs and returns a finite number.
    const past = new Date(Date.now() - 30_000).toISOString();
    const stale = computeStaleness(past);
    expect(stale).not.toBeNull();
    expect(stale!).toBeGreaterThanOrEqual(29);
    expect(stale!).toBeLessThanOrEqual(31);
  });
});

describe("mergeLivePriceForDisplay", () => {
  const STATIC: Price = {
    usd: 100.0,
    change_24h_pct: 1.0,
    market_cap_usd: 50_000_000_000,
    volume_24h_usd: 1_000_000_000,
    updated_at: "2026-04-30T06:00:00Z",
    source: "coingecko",
  };

  const LIVE: LiveAssetEntry = {
    price_usd: 123.45,
    change_24h_pct: 2.5,
    volume_24h_usd: 1_500_000_000,
    source: "coingecko",
    updated_at: "2026-04-30T12:00:00+09:00",
  };

  it("returns staticPrice unchanged when live is null", () => {
    expect(mergeLivePriceForDisplay(STATIC, null)).toEqual(STATIC);
  });

  it("returns staticPrice unchanged when live is undefined", () => {
    expect(mergeLivePriceForDisplay(STATIC, undefined)).toEqual(STATIC);
  });

  it("returns staticPrice when live.status === 'unavailable'", () => {
    const unavail: LiveAssetEntry = {
      price_usd: null,
      change_24h_pct: null,
      volume_24h_usd: null,
      source: "dexscreener",
      updated_at: null,
      status: "unavailable",
    };
    expect(mergeLivePriceForDisplay(STATIC, unavail)).toEqual(STATIC);
  });

  it("returns staticPrice when live.price_usd is null", () => {
    const partial: LiveAssetEntry = {
      ...LIVE,
      price_usd: null,
    };
    expect(mergeLivePriceForDisplay(STATIC, partial)).toEqual(STATIC);
  });

  it("returns staticPrice when live.updated_at is null", () => {
    const partial: LiveAssetEntry = {
      ...LIVE,
      updated_at: null,
    };
    expect(mergeLivePriceForDisplay(STATIC, partial)).toEqual(STATIC);
  });

  it("overlays live price/change/volume/source/updated_at on static, keeps static market_cap", () => {
    const merged = mergeLivePriceForDisplay(STATIC, LIVE);
    expect(merged).toEqual({
      usd: 123.45,
      change_24h_pct: 2.5,
      market_cap_usd: 50_000_000_000, // from static
      volume_24h_usd: 1_500_000_000, // from live
      updated_at: "2026-04-30T12:00:00+09:00",
      source: "coingecko",
    });
  });

  it("falls back to static change_24h_pct when live.change_24h_pct is null", () => {
    const partial: LiveAssetEntry = { ...LIVE, change_24h_pct: null };
    const merged = mergeLivePriceForDisplay(STATIC, partial);
    expect(merged?.change_24h_pct).toBe(1.0);
  });

  it("falls back to static volume when live.volume_24h_usd is null", () => {
    const partial: LiveAssetEntry = { ...LIVE, volume_24h_usd: null };
    const merged = mergeLivePriceForDisplay(STATIC, partial);
    expect(merged?.volume_24h_usd).toBe(1_000_000_000);
  });

  it("works when staticPrice is null and live is fully available", () => {
    const merged = mergeLivePriceForDisplay(null, LIVE);
    expect(merged).toEqual({
      usd: 123.45,
      change_24h_pct: 2.5,
      market_cap_usd: null,
      volume_24h_usd: 1_500_000_000,
      updated_at: "2026-04-30T12:00:00+09:00",
      source: "coingecko",
    });
  });

  it("returns null when both static and live are null/missing", () => {
    expect(mergeLivePriceForDisplay(null, null)).toBeNull();
    expect(mergeLivePriceForDisplay(null, undefined)).toBeNull();
  });
});
