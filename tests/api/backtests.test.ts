import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";

const FIXTURE = path.join(
  __dirname,
  "../fixtures/pivots/backtest.sample.json",
);
const ENV_KEY = "LM_PIVOT_BACKTEST_PATH";

describe("/api/backtests route", () => {
  const orig = process.env[ENV_KEY];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  async function invokeGet(query: string): Promise<Response> {
    const { GET } = await import("@/app/api/backtests/route");
    return GET(new Request(`http://test.local/api/backtests?${query}`));
  }

  it("returns 200 + metrics for matched entry (default threshold 70)", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=BTC&horizon=30D&score_type=overall");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asset).toBe("BTC");
    expect(body.horizon).toBe("30D");
    expect(body.score_type).toBe("overall");
    expect(body.threshold).toBe(70);
    expect(body.metrics.precision).toBe(0.64);
    expect(body.metrics.sample_size).toBe(118);
  });

  it("returns 200 + metrics for explicit threshold=80", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet(
      "asset=BTC&horizon=30D&score_type=overall&threshold=80",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threshold).toBe(80);
    expect(body.metrics.precision).toBe(0.71);
  });

  it("404 on unmatched entry (Codex requirement: no fall-through)", async () => {
    process.env[ENV_KEY] = FIXTURE;
    // ETH / 90D / volatility_pivot is not in the fixture
    const res = await invokeGet(
      "asset=ETH&horizon=90D&score_type=volatility_pivot",
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/);
    expect(body.asset).toBe("ETH");
    expect(body.horizon).toBe("90D");
    expect(body.score_type).toBe("volatility_pivot");
  });

  it("404 on unmatched threshold for an existing (asset, horizon, score_type)", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet(
      "asset=BTC&horizon=30D&score_type=overall&threshold=99",
    );
    expect(res.status).toBe(404);
  });

  it("400 on invalid asset", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=SOL&horizon=30D&score_type=overall");
    expect(res.status).toBe(400);
  });

  it("400 on invalid score_type", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet(
      "asset=BTC&horizon=30D&score_type=meme_pivot",
    );
    expect(res.status).toBe(400);
  });

  it("400 on threshold out of range", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet(
      "asset=BTC&horizon=30D&score_type=overall&threshold=150",
    );
    expect(res.status).toBe(400);
  });

  it("400 on threshold non-numeric", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet(
      "asset=BTC&horizon=30D&score_type=overall&threshold=high",
    );
    expect(res.status).toBe(400);
  });

  it("sets Cache-Control: no-store + Server-Timing", async () => {
    process.env[ENV_KEY] = FIXTURE;
    const res = await invokeGet("asset=BTC&horizon=30D&score_type=overall");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("server-timing")).toMatch(/^read;dur=/);
  });
});
