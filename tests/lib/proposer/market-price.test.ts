import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { freshnessCutoffDate, readMarketPrices } from "@/lib/proposer/market-price";

const FIXTURE = path.join(__dirname, "../../fixtures/proposer/market-indicators.sample.jsonl");
// fixture の最新行 (2026-04-21) の翌朝 08:03 JST
const FIXTURE_NOW = "2026-04-21T23:03:00Z";

function tmpFile(prefix: string, rows: unknown[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const p = path.join(dir, "mi.jsonl");
  fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return p;
}

describe("readMarketPrices", () => {
  it("returns latest flat-lowercase price for each asset", async () => {
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: FIXTURE,
      assets: ["ADA", "BTC", "ETH", "NIGHT"],
      nowIso: FIXTURE_NOW,
    });
    // Latest row (2026-04-21) uses flat lowercase: btc / eth / ada / night
    expect(prices.ADA).toBe(0.251);
    expect(prices.BTC).toBe(108200);
    expect(prices.ETH).toBe(3950);
    expect(prices.NIGHT).toBe(0.047);
  });

  it("falls through _usd and _usdt suffixes when flat key missing", async () => {
    const p = tmpFile("mp-", [{ date: "2026-04-19", ada_usd: 0.3, night_usdt: 0.05 }]);
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: p,
      assets: ["ADA", "NIGHT"],
      nowIso: FIXTURE_NOW,
    });
    expect(prices.ADA).toBe(0.3);
    expect(prices.NIGHT).toBe(0.05);
  });

  it("omits assets missing from all rows", async () => {
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: FIXTURE,
      assets: ["ADA", "XRP"],
      nowIso: FIXTURE_NOW,
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mp2-"));
    const p = path.join(dir, "mi.jsonl");
    fs.writeFileSync(p, "not json\n" + JSON.stringify({ date: "2026-04-21", ada: 0.25 }) + "\n");
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: p,
      assets: ["ADA"],
      nowIso: FIXTURE_NOW,
    });
    expect(prices.ADA).toBe(0.25);
  });

  it("ignores rows older than 3 days (NIGHT stopped being recorded on 2026-10-03)", async () => {
    const p = tmpFile("mp3-", [
      { date: "2026-09-28", ada_usd: 0.25, night_usdt: 0.05 },
      { date: "2026-10-03", ada_usd: 0.24 },
    ]);
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: p,
      assets: ["ADA", "NIGHT"],
      nowIso: "2026-10-02T22:00:00Z", // 2026-10-03 07:00 JST
    });
    expect(prices.ADA).toBe(0.24);
    expect(prices.NIGHT).toBeUndefined();
  });

  it("keeps a row exactly 3 days old", async () => {
    const p = tmpFile("mp4-", [{ date: "2026-09-30", night_usdt: 0.05 }]);
    const prices = await readMarketPrices({
      marketIndicatorsJsonlPath: p,
      assets: ["NIGHT"],
      nowIso: "2026-10-02T22:00:00Z", // 2026-10-03 07:00 JST
    });
    expect(prices.NIGHT).toBe(0.05);
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
    // ADA と BTC は 2026-10-03 以降も Hyperliquid から毎日記録される
    expect(prices.ADA).toBeGreaterThan(0);
    expect(prices.BTC).toBeGreaterThan(10000);
  });
});

describe("freshnessCutoffDate", () => {
  it("uses the JST calendar day of nowIso", () => {
    expect(freshnessCutoffDate("2026-10-02T14:59:00Z", 3)).toBe("2026-09-29"); // 10-02 23:59 JST
    expect(freshnessCutoffDate("2026-10-02T15:00:00Z", 3)).toBe("2026-09-30"); // 10-03 00:00 JST
  });
});
