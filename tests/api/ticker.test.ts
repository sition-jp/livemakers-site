import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("/api/ticker route handler", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("returns merged ticker data on success", async () => {
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
        // /v2/chains returns an array of chain objects
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
      if (url.includes("koios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ epoch_no: 624 }]),
        });
      }
      return Promise.reject(new Error("unexpected url: " + url));
    });

    const { GET } = await import("@/app/api/ticker/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ada.price_usd).toBe(0.2454);
    expect(body.tvl.cardano_usd).toBe(133900000);
    expect(body.epoch).toBe(624);
    expect(body.updated_at).toBeDefined();
  });

  it("returns partial data (tvl=0) when DefiLlama fails", async () => {
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
      if (url.includes("koios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ epoch_no: 624 }]),
        });
      }
      return Promise.reject(new Error("unexpected url: " + url));
    });

    const { GET } = await import("@/app/api/ticker/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ada.price_usd).toBe(0.2454);
    expect(body.tvl.cardano_usd).toBe(0);
    expect(body.epoch).toBe(624);
  });

  it("returns 503 when CoinGecko (primary source) fails", async () => {
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
      if (url.includes("koios")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ epoch_no: 624 }]),
        });
      }
      return Promise.reject(new Error("unexpected url: " + url));
    });

    const { GET } = await import("@/app/api/ticker/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ticker unavailable");
  });
});
