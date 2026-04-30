import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const FIXTURE = path.join(
  __dirname,
  "../fixtures/terminal/terminal_assets.live.sample.json",
);
const ENV_KEY = "LM_TERMINAL_LIVE_SNAPSHOT_PATH";

describe("/api/dashboard/live route", () => {
  const orig = process.env[ENV_KEY];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  async function invokeGet(): Promise<Response> {
    const { GET } = await import("@/app/api/dashboard/live/route");
    return GET();
  }

  describe("happy path", () => {
    it("returns 200 + TerminalLiveSnapshot when fixture present", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.schema_version).toBe("terminal_live_v0");
      expect(body.assets.BTC.price_usd).toBe(123456.78);
      expect(body.assets.NIGHT.status).toBe("unavailable");
      expect(body.cardano.epoch).toBe(628);
    });

    it("sets Cache-Control: no-store and Server-Timing read;dur=<ms>", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet();
      expect(res.headers.get("cache-control")).toBe("no-store");
      const st = res.headers.get("server-timing") ?? "";
      // Standard form: `read;dur=<number>` (number ≥ 0).
      expect(st).toMatch(/^read;dur=\d+(\.\d+)?$/);
    });

    it("does NOT set ETag (incompatible with no-store per spec §4.1)", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet();
      expect(res.headers.get("etag")).toBeNull();
    });
  });

  describe("degrade — file absent (pre-cron state)", () => {
    it("returns 200 + skeleton with all 4 assets unavailable", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      process.env[ENV_KEY] = path.join(tmp, "nope.json");
      const res = await invokeGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.schema_version).toBe("terminal_live_v0");
      expect(Object.keys(body.assets).sort()).toEqual([
        "ADA",
        "BTC",
        "ETH",
        "NIGHT",
      ]);
      for (const ticker of ["BTC", "ETH", "ADA", "NIGHT"]) {
        const entry = body.assets[ticker];
        expect(entry.price_usd).toBeNull();
        expect(entry.updated_at).toBeNull();
        expect(entry.status).toBe("unavailable");
      }
      expect(body.cardano.epoch).toBeNull();
      expect(body.cardano.status).toBe("unavailable");
    });

    it("still sets no-store + Server-Timing on absent-file response", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      process.env[ENV_KEY] = path.join(tmp, "nope.json");
      const res = await invokeGet();
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("server-timing")).toMatch(/^read;dur=/);
    });
  });

  describe("degrade — JSON malformed", () => {
    it("returns 503", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      const bad = path.join(tmp, "bad.json");
      fs.writeFileSync(bad, "{ totally not json");
      process.env[ENV_KEY] = bad;
      const res = await invokeGet();
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toMatch(/unavailable/);
      expect(body.reason).toMatch(/JSON\.parse/);
    });

    it("503 still carries no-store + Server-Timing", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      const bad = path.join(tmp, "bad.json");
      fs.writeFileSync(bad, "{ totally not json");
      process.env[ENV_KEY] = bad;
      const res = await invokeGet();
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("server-timing")).toMatch(/^read;dur=/);
    });
  });

  describe("degrade — schema violation", () => {
    it("returns 503 when JSON parses but schema rejects", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      const bad = path.join(tmp, "schema.json");
      fs.writeFileSync(
        bad,
        JSON.stringify({
          schema_version: "terminal_live_v0",
          generated_at: "x",
          // missing sources, assets, cardano
        }),
      );
      process.env[ENV_KEY] = bad;
      const res = await invokeGet();
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.reason).toMatch(/schema/);
    });
  });
});
