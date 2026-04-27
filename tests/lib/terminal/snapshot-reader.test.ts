import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  readTerminalAssetsSnapshot,
  resolveSnapshotPath,
} from "@/lib/terminal/snapshot-reader";

const FIXTURE = path.join(
  __dirname,
  "../../fixtures/terminal/terminal_assets.sample.json",
);

const ENV_KEY = "LM_TERMINAL_SNAPSHOT_PATH";

describe("snapshot-reader", () => {
  const orig = process.env[ENV_KEY];

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  describe("happy path", () => {
    it("reads fixture and returns parsed snapshot when file exists", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const result = await readTerminalAssetsSnapshot();
      expect(result.fileExists).toBe(true);
      expect(result.snapshot).not.toBeNull();
      expect(result.snapshot?.assets.ADA.asset).toBe("ADA");
      expect(result.snapshot?.assets.ADA.signals.total_active).toBe(6);
      expect(result.snapshot?.assets.NIGHT.price?.market_cap_usd).toBeNull();
    });

    it("returns mtimeMs > 0 when file present", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const result = await readTerminalAssetsSnapshot();
      expect(result.mtimeMs).toBeGreaterThan(0);
    });
  });

  describe("degrade — missing file", () => {
    it("returns fileExists=false and snapshot=null when file is absent (pre-launch state)", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-snap-"));
      process.env[ENV_KEY] = path.join(tmp, "does_not_exist.json");
      const result = await readTerminalAssetsSnapshot();
      expect(result.fileExists).toBe(false);
      expect(result.snapshot).toBeNull();
      expect(result.parseError).toBeNull();
    });
  });

  describe("degrade — invalid JSON", () => {
    it("returns fileExists=true, snapshot=null, parseError set when JSON is malformed", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-snap-"));
      const bad = path.join(tmp, "bad.json");
      fs.writeFileSync(bad, "{ not: valid json }");
      process.env[ENV_KEY] = bad;
      const result = await readTerminalAssetsSnapshot();
      expect(result.fileExists).toBe(true);
      expect(result.snapshot).toBeNull();
      expect(result.parseError).toBeTruthy();
    });
  });

  describe("degrade — schema violation", () => {
    it("returns fileExists=true, snapshot=null when JSON parses but schema rejects", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-snap-"));
      const bad = path.join(tmp, "schema_violation.json");
      // Valid JSON but missing required `assets`
      fs.writeFileSync(
        bad,
        JSON.stringify({ schema_version: "0.1", generated_at: "x" }),
      );
      process.env[ENV_KEY] = bad;
      const result = await readTerminalAssetsSnapshot();
      expect(result.fileExists).toBe(true);
      expect(result.snapshot).toBeNull();
      expect(result.parseError).toBeTruthy();
    });
  });

  describe("path resolution", () => {
    it("resolveSnapshotPath returns env override when set", () => {
      process.env[ENV_KEY] = "/custom/path.json";
      expect(resolveSnapshotPath()).toBe("/custom/path.json");
    });

    it("resolveSnapshotPath returns default 07_DATA path when env unset", () => {
      delete process.env[ENV_KEY];
      const p = resolveSnapshotPath();
      expect(p).toContain("terminal_assets.json");
    });
  });
});
