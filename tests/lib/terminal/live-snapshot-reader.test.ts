import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  readTerminalLiveSnapshot,
  resolveLiveSnapshotPath,
} from "@/lib/terminal/live-snapshot-reader";

const FIXTURE = path.join(
  __dirname,
  "../../fixtures/terminal/terminal_assets.live.sample.json",
);

const ENV_KEY = "LM_TERMINAL_LIVE_SNAPSHOT_PATH";

describe("live-snapshot-reader", () => {
  const orig = process.env[ENV_KEY];

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  describe("happy path", () => {
    it("reads fixture and returns parsed snapshot", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const result = await readTerminalLiveSnapshot();
      expect(result.fileExists).toBe(true);
      expect(result.parseError).toBeNull();
      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot?.schema_version).toBe("terminal_live_v0");
      expect(result.snapshot?.assets.BTC.price_usd).toBe(123456.78);
      expect(result.snapshot?.assets.NIGHT.price_usd).toBeNull();
      expect(result.snapshot?.assets.NIGHT.status).toBe("unavailable");
      expect(result.snapshot?.cardano.epoch).toBe(628);
    });

    it("returns mtimeMs > 0 when file present", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const result = await readTerminalLiveSnapshot();
      expect(result.mtimeMs).toBeGreaterThan(0);
    });
  });

  describe("degrade — missing file (pre-cron state)", () => {
    it("returns fileExists=false, snapshot=null, parseError=null", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      process.env[ENV_KEY] = path.join(tmp, "does_not_exist.json");
      const result = await readTerminalLiveSnapshot();
      expect(result.fileExists).toBe(false);
      expect(result.snapshot).toBeNull();
      expect(result.parseError).toBeNull();
    });
  });

  describe("degrade — invalid JSON", () => {
    it("returns fileExists=true, snapshot=null, parseError set", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      const bad = path.join(tmp, "bad.json");
      fs.writeFileSync(bad, "{ not: valid json");
      process.env[ENV_KEY] = bad;
      const result = await readTerminalLiveSnapshot();
      expect(result.fileExists).toBe(true);
      expect(result.snapshot).toBeNull();
      expect(result.parseError).toMatch(/JSON\.parse/);
    });
  });

  describe("degrade — schema violation", () => {
    it("returns fileExists=true, snapshot=null when JSON parses but schema rejects", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      const bad = path.join(tmp, "schema_violation.json");
      // Valid JSON but missing required `assets` and `cardano`
      fs.writeFileSync(
        bad,
        JSON.stringify({
          schema_version: "terminal_live_v0",
          generated_at: "2026-04-30T12:00:00+09:00",
          sources: {
            price: "coingecko",
            cardano: "koios",
            night_price: "dexscreener",
          },
        }),
      );
      process.env[ENV_KEY] = bad;
      const result = await readTerminalLiveSnapshot();
      expect(result.fileExists).toBe(true);
      expect(result.snapshot).toBeNull();
      expect(result.parseError).toMatch(/schema/);
    });

    it("rejects wrong schema_version literal", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-live-"));
      const bad = path.join(tmp, "wrong_version.json");
      fs.writeFileSync(
        bad,
        JSON.stringify({
          schema_version: "terminal_live_v1",
          generated_at: "x",
          sources: {
            price: "coingecko",
            cardano: "koios",
            night_price: "dexscreener",
          },
          assets: {},
          cardano: {},
        }),
      );
      process.env[ENV_KEY] = bad;
      const result = await readTerminalLiveSnapshot();
      expect(result.snapshot).toBeNull();
      expect(result.parseError).toMatch(/schema/);
    });
  });

  describe("path resolution", () => {
    it("returns env override when set", () => {
      process.env[ENV_KEY] = "/custom/live/path.json";
      expect(resolveLiveSnapshotPath()).toBe("/custom/live/path.json");
    });

    it("returns default 07_DATA path when env unset", () => {
      delete process.env[ENV_KEY];
      const p = resolveLiveSnapshotPath();
      expect(p).toContain("terminal_assets.live.json");
    });
  });
});
