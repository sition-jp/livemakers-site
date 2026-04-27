import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const FIXTURE = path.join(
  __dirname,
  "../fixtures/terminal/terminal_assets.sample.json",
);
const ENV_KEY = "LM_TERMINAL_SNAPSHOT_PATH";

describe("/api/dashboard route", () => {
  const orig = process.env[ENV_KEY];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (orig === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = orig;
  });

  async function invokeGet(
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const { GET } = await import("@/app/api/dashboard/route");
    const req = new Request("http://localhost/api/dashboard", { headers });
    return GET(req);
  }

  describe("happy path", () => {
    it("returns 200 + DashboardResponse when fixture present", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.assets.BTC.asset).toBe("BTC");
      expect(body.assets.ADA.asset).toBe("ADA");
      expect(body.assets.ADA.signals.total_active).toBe(6);
      expect(body.meta.schema_version).toBe("0.1");
    });

    it("sets weak ETag and Cache-Control headers", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const res = await invokeGet();
      const etag = res.headers.get("etag");
      expect(etag).toMatch(/^W\//);
      const cc = res.headers.get("cache-control") ?? "";
      expect(cc).toContain("max-age=");
      expect(cc).toContain("stale-while-revalidate=");
    });

    it("returns 304 when If-None-Match matches the ETag", async () => {
      process.env[ENV_KEY] = FIXTURE;
      const first = await invokeGet();
      const etag = first.headers.get("etag");
      expect(etag).toBeTruthy();
      const second = await invokeGet({ "if-none-match": etag! });
      expect(second.status).toBe(304);
    });
  });

  describe("degrade — file absent", () => {
    it("returns 200 + skeleton with all 4 assets and empty inner fields", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-dash-"));
      process.env[ENV_KEY] = path.join(tmp, "nope.json");
      const res = await invokeGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Object.keys(body.assets).sort()).toEqual(
        ["ADA", "BTC", "ETH", "NIGHT"],
      );
      expect(body.assets.ADA.signals.items).toEqual([]);
      expect(body.assets.ADA.signals.total_active).toBe(0);
      expect(body.assets.ADA.news.items).toEqual([]);
      expect(body.assets.ADA.price).toBeNull();
    });
  });

  describe("degrade — JSON malformed", () => {
    it("returns 503 when builder output is unrecoverable", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lm-dash-"));
      const bad = path.join(tmp, "bad.json");
      fs.writeFileSync(bad, "{ totally not json");
      process.env[ENV_KEY] = bad;
      const res = await invokeGet();
      expect(res.status).toBe(503);
    });
  });
});
