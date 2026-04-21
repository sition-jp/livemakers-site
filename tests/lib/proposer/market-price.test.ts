import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { readMarketPrices } from "@/lib/proposer/market-price";

const FIXTURE = path.join(__dirname, "../../fixtures/proposer/market-indicators.sample.jsonl");

describe("readMarketPrices", () => {
  it("returns latest flat-lowercase price for each asset", async () => {
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: FIXTURE,
      assets: ["ADA", "BTC", "ETH", "NIGHT"],
    });
    // Latest row (2026-04-21) uses flat lowercase: btc / eth / ada / night
    expect(prices.ADA).toBe(0.251);
    expect(prices.BTC).toBe(108200);
    expect(prices.ETH).toBe(3950);
    expect(prices.NIGHT).toBe(0.047);
  });

  it("falls through _usd and _usdt suffixes when flat key missing", async () => {
    // Create a temp fixture with only suffix keys
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mp-"));
    const p = path.join(tmp, "mi.jsonl");
    fs.writeFileSync(
      p,
      JSON.stringify({ date: "2026-04-19", ada_usd: 0.3, night_usdt: 0.05 }) + "\n",
    );
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: p,
      assets: ["ADA", "NIGHT"],
    });
    expect(prices.ADA).toBe(0.3);
    expect(prices.NIGHT).toBe(0.05);
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
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mp2-"));
    const p = path.join(tmp, "mi.jsonl");
    fs.writeFileSync(
      p,
      "not json\n" + JSON.stringify({ date: "2026-04-21", ada: 0.25 }) + "\n",
    );
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: p,
      assets: ["ADA"],
    });
    expect(prices.ADA).toBe(0.25);
  });

  it("parses real production market_indicators.jsonl shape (regression guard)", async () => {
    // Real production path — this test requires the file to exist, skip if absent
    const prodPath =
      "/Users/sition/Documents/SITION/07_DATA/content/intelligence/market_indicators.jsonl";
    if (!fs.existsSync(prodPath)) return;
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: prodPath,
      assets: ["ADA", "BTC", "ETH", "NIGHT"],
    });
    // At minimum, should get ADA and BTC populated (present in latest row)
    expect(prices.ADA).toBeGreaterThan(0);
    expect(prices.BTC).toBeGreaterThan(10000);
  });
});
