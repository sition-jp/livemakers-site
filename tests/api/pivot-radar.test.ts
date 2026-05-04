import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const FIXTURE = path.join(
  __dirname,
  "../fixtures/pivots/assets.sample.json",
);
const ENV_KEY = "LM_PIVOT_ASSETS_PATH";

describe("/api/pivot-radar route", () => {
  const orig = process.env[ENV_KEY];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  async function invokeGet(): Promise<Response> {
    const { GET } = await import("@/app/api/pivot-radar/route");
    return GET();
  }

  it("returns 200 + radar list when fixture present", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timestamp).toBe("2026-05-04T00:00:00Z");
    expect(body.assets.length).toBe(2);
    const symbols = body.assets.map((a: { symbol: string }) => a.symbol);
    expect(symbols).toContain("BTC");
    expect(symbols).toContain("ETH");
    const btc = body.assets.find((a: { symbol: string }) => a.symbol === "BTC");
    expect(btc.scores["7D"].overall).toBe(74);
    expect(btc.scores["30D"].confidence_grade).toBe("B+");
  });

  it("sets Cache-Control: no-store and Server-Timing read;dur=<ms>", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("server-timing")).toMatch(/^read;dur=\d+(\.\d+)?$/);
  });

  it("file absent → 200 + empty assets list", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-pivot-"));
    process.env[ENV_KEY] = path.join(tmp, "nope.json");
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assets).toEqual([]);
    expect(typeof body.timestamp).toBe("string");
  });

  it("malformed JSON → 503 with reason", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-pivot-"));
    const bad = path.join(tmp, "bad.json");
    fs.writeFileSync(bad, "{ not json");
    process.env[ENV_KEY] = bad;
    const res = await invokeGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/unavailable/);
    expect(body.reason).toMatch(/JSON\.parse/);
  });

  it("schema violation → 503 with reason", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-pivot-"));
    const bad = path.join(tmp, "wrong.json");
    fs.writeFileSync(bad, JSON.stringify({ schema_version: "v0.1" }));
    process.env[ENV_KEY] = bad;
    const res = await invokeGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reason).toMatch(/schema/);
  });
});
