import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const FIXTURE = path.join(
  __dirname,
  "../fixtures/terminal/terminal_assets.sample.json",
);
const ENV_KEY = "LM_TERMINAL_SNAPSHOT_PATH";

describe("/api/assets/[asset]/summary route", () => {
  const orig = process.env[ENV_KEY];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  async function invokeGet(
    asset: string,
    headers: Record<string, string> = {},
    query = "",
  ): Promise<Response> {
    const { GET } = await import(
      "@/app/api/assets/[asset]/summary/route"
    );
    const req = new Request(
      `http://localhost/api/assets/${asset}/summary${query}`,
      { headers },
    );
    return GET(req, { params: Promise.resolve({ asset }) });
  }

  describe("happy path — each of the 4 assets", () => {
    it("/api/assets/ada/summary returns 200 + ADA AssetSummary", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet("ada");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asset).toBe("ADA");
      expect(body.display_name).toBe("Cardano");
      expect(body.signals.total_active).toBe(6);
      expect(body.ada.governance.drep_card.display_name).toBe("SIPO");
    });

    it("/api/assets/btc/summary returns 200 + BTC AssetSummary", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet("btc");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asset).toBe("BTC");
      expect(body.display_name).toBe("Bitcoin");
      expect(body.btc.etf.aum_usd).toBe(108700000000);
    });

    it("/api/assets/eth/summary returns 200 + ETH AssetSummary", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet("eth");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asset).toBe("ETH");
    });

    it("/api/assets/night/summary returns 200 + NIGHT AssetSummary with null mcap", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet("night");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asset).toBe("NIGHT");
      expect(body.price.market_cap_usd).toBeNull();
      expect(body.price.volume_24h_usd).toBeNull();
    });
  });

  describe("URL casing", () => {
    it("accepts uppercase asset (ADA)", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet("ADA");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asset).toBe("ADA");
    });
  });

  describe("invalid asset", () => {
    it("returns 400 for unknown asset (doge)", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet("doge");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/asset/i);
    });
  });

  describe("HTTP cache contract", () => {
    it("sets weak ETag scoped to asset", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const adaRes = await invokeGet("ada");
      const btcRes = await invokeGet("btc");
      const adaEtag = adaRes.headers.get("etag");
      const btcEtag = btcRes.headers.get("etag");
      expect(adaEtag).toMatch(/^W\//);
      expect(btcEtag).toMatch(/^W\//);
      // Per-asset ETags should not collide
      expect(adaEtag).not.toBe(btcEtag);
    });

    it("returns 304 on matching If-None-Match", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const first = await invokeGet("ada");
      const etag = first.headers.get("etag");
      expect(etag).toBeTruthy();
      const second = await invokeGet("ada", { "if-none-match": etag! });
      expect(second.status).toBe(304);
    });
  });

  describe("degrade — file absent", () => {
    it("returns 200 + empty AssetSummary skeleton when builder output missing", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-asset-"));
      process.env[ENV_KEY] = path.join(tmp, "nope.json");
      const res = await invokeGet("ada");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.asset).toBe("ADA");
      expect(body.price).toBeNull();
      expect(body.signals.items).toEqual([]);
      expect(body.signals.total_active).toBe(0);
      expect(body.news.items).toEqual([]);
      // ada extension absent in skeleton
      expect(body.ada).toBeUndefined();
    });
  });

  describe("degrade — JSON malformed", () => {
    it("returns 503 when builder output is unrecoverable", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-asset-"));
      const bad = path.join(tmp, "bad.json");
      fs.writeFileSync(bad, "{ bogus");
      process.env[ENV_KEY] = bad;
      const res = await invokeGet("ada");
      expect(res.status).toBe(503);
    });
  });
});
