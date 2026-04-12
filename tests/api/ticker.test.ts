import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Build a Koios mock dispatcher.
 *
 * Returns a fake response for each Koios endpoint touched by the ticker
 * route. Tests can override individual fields by passing options.
 */
function koiosMock(opts: {
  tipEpoch?: number;
  activeStake?: string; // lovelace
  circulation?: string; // lovelace
  poolStakes?: bigint[]; // sorted desc OR raw — function will sort
  poolListFail?: boolean;
} = {}) {
  const {
    tipEpoch = 624,
    activeStake = "21000000000000000", // ~21B ADA in lovelace
    circulation = "35000000000000000", // ~35B ADA → 60% stake ratio
    poolStakes = [
      // Default: 4 large pools each at 30% = top 2 control >50% → naka=2
      300n * 10n ** 15n,
      300n * 10n ** 15n,
      200n * 10n ** 15n,
      200n * 10n ** 15n,
    ],
    poolListFail = false,
  } = opts;

  return (url: string) => {
    if (url.includes("/tip")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ epoch_no: tipEpoch }]),
      });
    }
    if (url.includes("/epoch_info")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ active_stake: activeStake }]),
      });
    }
    if (url.includes("/totals")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ circulation }]),
      });
    }
    if (url.includes("/pool_list")) {
      if (poolListFail) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      // Match offset query and return slice of poolStakes paginated by 1000
      const offsetMatch = url.match(/offset=(\d+)/);
      const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
      const slice = poolStakes
        .slice(offset, offset + 1000)
        .map((s) => ({ active_stake: s.toString() }));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(slice),
      });
    }
    return null;
  };
}

describe("/api/ticker route handler", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("returns merged ticker data on success (incl. real stake + naka)", async () => {
    const koios = koiosMock();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("coingecko")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              cardano: {
                usd: 0.2454,
                usd_24h_change: -2.1,
                usd_market_cap: 9050000000,
              },
            }),
        });
      }
      if (url.includes("llama.fi")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { name: "Ethereum", tvl: 50000000000 },
              { name: "Cardano", tvl: 133900000 },
              { name: "Solana", tvl: 4200000000 },
            ]),
        });
      }
      return koios(url) ?? Promise.reject(new Error("unexpected url: " + url));
    });

    const { GET } = await import("@/app/api/ticker/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ada.price_usd).toBe(0.2454);
    expect(body.tvl.cardano_usd).toBe(133900000);
    expect(body.epoch).toBe(624);
    // 21B / 35B = 60%
    expect(body.stake.active_percent).toBeCloseTo(60.0, 1);
    // Top 2 of 4 equal-300 pools control 60% > 50% → naka = 2
    expect(body.naka).toBe(2);
    expect(body.updated_at).toBeDefined();
  });

  it("returns partial data (tvl=0) when DefiLlama fails", async () => {
    const koios = koiosMock();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("coingecko")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              cardano: {
                usd: 0.2454,
                usd_24h_change: -2.1,
                usd_market_cap: 9050000000,
              },
            }),
        });
      }
      if (url.includes("llama.fi")) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return koios(url) ?? Promise.reject(new Error("unexpected url: " + url));
    });

    const { GET } = await import("@/app/api/ticker/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ada.price_usd).toBe(0.2454);
    expect(body.tvl.cardano_usd).toBe(0);
    expect(body.epoch).toBe(624);
    // Stake / naka still resolved from Koios mock
    expect(body.stake.active_percent).toBeCloseTo(60.0, 1);
    expect(body.naka).toBe(2);
  });

  it("returns 503 when CoinGecko (primary source) fails", async () => {
    const koios = koiosMock();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("coingecko")) {
        return Promise.resolve({ ok: false, status: 429 });
      }
      if (url.includes("llama.fi")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([{ name: "Cardano", tvl: 133900000 }]),
        });
      }
      return koios(url) ?? Promise.reject(new Error("unexpected url: " + url));
    });

    const { GET } = await import("@/app/api/ticker/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ticker unavailable");
  });

  it("returns naka=0 when Koios pool_list fails (graceful degradation)", async () => {
    const koios = koiosMock({ poolListFail: true });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("coingecko")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              cardano: {
                usd: 0.2454,
                usd_24h_change: -2.1,
                usd_market_cap: 9050000000,
              },
            }),
        });
      }
      if (url.includes("llama.fi")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([{ name: "Cardano", tvl: 133900000 }]),
        });
      }
      return koios(url) ?? Promise.reject(new Error("unexpected url: " + url));
    });

    const { GET } = await import("@/app/api/ticker/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    // Stake still works (uses different endpoints), naka degrades to 0
    expect(body.stake.active_percent).toBeCloseTo(60.0, 1);
    expect(body.naka).toBe(0);
  });
});
