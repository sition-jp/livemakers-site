import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const FIXTURE = path.join(
  __dirname,
  "../fixtures/pivots/assets.sample.json",
);
const ENV_KEY = "LM_PIVOT_ASSETS_PATH";

describe("/api/pivot-scores route", () => {
  const orig = process.env[ENV_KEY];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  async function invokeGet(query: string): Promise<Response> {
    const { GET } = await import("@/app/api/pivot-scores/route");
    return GET(new Request(`http://test.local/api/pivot-scores?${query}`));
  }

  it("returns 200 + full detail for BTC/30D", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=BTC&horizon=30D");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asset.symbol).toBe("BTC");
    expect(body.horizon).toBe("30D");
    expect(body.scores.overall).toBe(78);
    expect(body.scores.confidence.grade).toBe("B+");
    expect(body.direction_bias.bullish).toBe(46);
    expect(body.evidence.length).toBeGreaterThan(0);
    expect(body.summary.level).toBe("High");
  });

  it("returns 200 + full detail for ETH/7D", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=ETH&horizon=7D");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asset.symbol).toBe("ETH");
    expect(body.horizon).toBe("7D");
  });

  it("400 on invalid asset", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=DOGE&horizon=30D");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
    expect(body.details.asset).toMatch(/BTC or ETH/);
  });

  it("400 on invalid horizon", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=BTC&horizon=14D");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.horizon).toMatch(/7D, 30D, or 90D/);
  });

  it("400 when params missing entirely", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("");
    expect(res.status).toBe(400);
  });

  it("503 when snapshot file is malformed", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-pivot-"));
    const bad = path.join(tmp, "bad.json");
    fs.writeFileSync(bad, "totally not json");
    process.env[ENV_KEY] = bad;
    const res = await invokeGet("asset=BTC&horizon=30D");
    expect(res.status).toBe(503);
  });

  it("sets Cache-Control: no-store + Server-Timing", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=BTC&horizon=7D");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("server-timing")).toMatch(/^read;dur=/);
  });
});
