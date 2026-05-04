import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

import {
  readAssetsSnapshot,
  readBacktestSnapshot,
  resolveAssetsPath,
  resolveBacktestPath,
} from "@/lib/pivots/pivots-reader";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/pivots");
const ASSETS_FIXTURE = path.join(FIXTURE_DIR, "assets.sample.json");
const BACKTEST_FIXTURE = path.join(FIXTURE_DIR, "backtest.sample.json");

const ASSETS_ENV = "LM_PIVOT_ASSETS_PATH";
const BACKTEST_ENV = "LM_PIVOT_BACKTEST_PATH";

function withTempEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("pivots-reader: assets snapshot", () => {
  const orig = process.env[ASSETS_ENV];

  afterEach(() => {
    withTempEnv(ASSETS_ENV, orig);
  });

  it("happy path: returns parsed snapshot, mtimeMs > 0, no parseError", async () => {
    process.env[ASSETS_ENV] = ASSETS_FIXTURE;
    const result = await readAssetsSnapshot();
    expect(result.fileExists).toBe(true);
    expect(result.parseError).toBeNull();
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot!.schema_version).toBe("v0.1");
    expect(result.snapshot!.radar.length).toBeGreaterThanOrEqual(2);
    expect(result.mtimeMs).toBeGreaterThan(0);
  });

  it("file absent → fileExists:false, snapshot:null, parseError:null", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pivot-"));
    process.env[ASSETS_ENV] = path.join(tmp, "nope.json");
    const result = await readAssetsSnapshot();
    expect(result.fileExists).toBe(false);
    expect(result.snapshot).toBeNull();
    expect(result.parseError).toBeNull();
    expect(result.mtimeMs).toBeNull();
  });

  it("malformed JSON → fileExists:true, parseError starts with 'JSON.parse'", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pivot-"));
    const bad = path.join(tmp, "bad.json");
    fs.writeFileSync(bad, "{ not really json");
    process.env[ASSETS_ENV] = bad;
    const result = await readAssetsSnapshot();
    expect(result.fileExists).toBe(true);
    expect(result.snapshot).toBeNull();
    expect(result.parseError).toMatch(/^JSON\.parse/);
  });

  it("schema violation → fileExists:true, parseError starts with 'schema'", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pivot-"));
    const bad = path.join(tmp, "wrong.json");
    fs.writeFileSync(
      bad,
      JSON.stringify({ schema_version: "v0.1", generated_at: "x" }),
    );
    process.env[ASSETS_ENV] = bad;
    const result = await readAssetsSnapshot();
    expect(result.fileExists).toBe(true);
    expect(result.snapshot).toBeNull();
    expect(result.parseError).toMatch(/^schema/);
  });

  it("resolveAssetsPath: env override beats default", () => {
    process.env[ASSETS_ENV] = "/tmp/explicit.json";
    expect(resolveAssetsPath()).toBe("/tmp/explicit.json");
  });

  it("resolveAssetsPath: default falls under cwd/data/pivot_assets.live.json", () => {
    delete process.env[ASSETS_ENV];
    const resolved = resolveAssetsPath();
    expect(resolved.endsWith("/data/pivot_assets.live.json")).toBe(true);
  });
});

describe("pivots-reader: backtest snapshot", () => {
  const orig = process.env[BACKTEST_ENV];

  afterEach(() => {
    withTempEnv(BACKTEST_ENV, orig);
  });

  it("happy path: parses entries[]", async () => {
    process.env[BACKTEST_ENV] = BACKTEST_FIXTURE;
    const result = await readBacktestSnapshot();
    expect(result.fileExists).toBe(true);
    expect(result.parseError).toBeNull();
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot!.entries.length).toBeGreaterThan(0);
    const first = result.snapshot!.entries[0];
    expect(first.metrics.precision).toBeGreaterThanOrEqual(0);
    expect(first.metrics.precision).toBeLessThanOrEqual(1);
  });

  it("file absent → graceful empty result", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pivot-"));
    process.env[BACKTEST_ENV] = path.join(tmp, "nope.json");
    const result = await readBacktestSnapshot();
    expect(result.fileExists).toBe(false);
    expect(result.snapshot).toBeNull();
    expect(result.parseError).toBeNull();
  });

  it("resolveBacktestPath: env override", () => {
    process.env[BACKTEST_ENV] = "/tmp/bt.json";
    expect(resolveBacktestPath()).toBe("/tmp/bt.json");
  });
});
