import { describe, it, expect } from "vitest";
import path from "path";
import { readMarketPrices } from "@/lib/proposer/market-price";

const FIXTURE = path.join(__dirname, "../../fixtures/proposer/market-indicators.sample.jsonl");

describe("readMarketPrices", () => {
  it("returns latest price for each asset", async () => {
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: FIXTURE,
      assets: ["ADA", "BTC", "ETH", "NIGHT"],
    });
    expect(prices.ADA).toBe(0.251);
    expect(prices.BTC).toBe(108200);
    expect(prices.ETH).toBe(3950);
    expect(prices.NIGHT).toBe(0.047);
  });

  it("omits assets missing from all rows", async () => {
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: FIXTURE,
      assets: ["ADA", "XRP"],
    });
    expect(prices.ADA).toBe(0.251);
    expect(prices.XRP).toBeUndefined();
  });

  it("returns empty when file missing", async () => {
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: "/tmp/no-such-file.jsonl",
      assets: ["ADA"],
    });
    expect(prices).toEqual({});
  });

  it("skips malformed lines gracefully", async () => {
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: FIXTURE,
      assets: ["ADA"],
    });
    expect(prices.ADA).toBe(0.251);
  });
});
