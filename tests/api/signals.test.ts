import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/signals");

describe("/api/signals route handler", () => {
  const origEnv = process.env.LM_SIGNALS_JSONL_PATH;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (origEnv === undefined) delete process.env.LM_SIGNALS_JSONL_PATH;
    else process.env.LM_SIGNALS_JSONL_PATH = origEnv;
  });

  async function invokeGet(url = "http://localhost/api/signals") {
    const { GET } = await import("@/app/api/signals/route");
    const req = new Request(url);
    return GET(req);
  }

  it("R-1: normal path — valid fixture returns 5 active signals above default confidence", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    // valid.jsonl: 5 active signals above 0.65, 1 active at 0.50, 1 superseded, 1 expired
    // Default bucket=all returns active + expired + superseded,
    // but min_confidence=0.65 filters: sig_001 (0.85), sig_002 (0.78), sig_003 (0.70),
    // sig_004 (0.68), sig_005 (0.72), sig_super (0.70, superseded), sig_exp (0.80, expired)
    // sig_low (0.50) drops. That's 7 >= 0.65.
    expect(body.signals.length).toBe(7);
    // total_active counts only status=active (before min_confidence filter per spec §2.3)
    expect(body.meta.total_active).toBe(6); // 5 active_hi + sig_low
    expect(body.meta.min_confidence).toBe(0.65);
    expect(body.meta.source_freshness_sec).toBeGreaterThanOrEqual(0);
  });

  it("R-2: latest-row-wins — same id as superseded (later) overrides earlier active", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "supersede.jsonl");
    const res = await invokeGet();
    const body = await res.json();
    // supersede.jsonl: sig_X active → sig_X superseded → sig_Y active (supersedes sig_X)
    // After collapse: sig_X=superseded (dropped by confidence check? 0.70 ≥ 0.65), sig_Y=active
    // All 3 surface (no bucket filter): sig_X (superseded) + sig_Y (active)
    const ids = body.signals.map((s: any) => s.id);
    // sig_X in its latest superseded state, sig_Y active
    const sigX = body.signals.find((s: any) => s.id === "sig_X");
    const sigY = body.signals.find((s: any) => s.id === "sig_Y");
    expect(sigX?.status).toBe("superseded");
    expect(sigY?.status).toBe("active");
    expect(sigY?.supersedes_signal_id).toBe("sig_X");
  });

  it("R-3: min_confidence=0.75 filters lower-confidence signals", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet(
      "http://localhost/api/signals?min_confidence=0.75"
    );
    const body = await res.json();
    // Above 0.75: sig_001 (0.85), sig_002 (0.78), sig_exp (0.80)
    const confidences = body.signals.map((s: any) => s.confidence);
    for (const c of confidences) expect(c).toBeGreaterThanOrEqual(0.75);
    expect(body.meta.min_confidence).toBe(0.75);
  });

  it("R-4: pillar=midnight_and_privacy filters to that pillar only", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet(
      "http://localhost/api/signals?pillar=midnight_and_privacy"
    );
    const body = await res.json();
    for (const s of body.signals) {
      expect(s.pillar).toBe("midnight_and_privacy");
    }
    // Just sig_004 in valid fixture
    expect(body.signals.length).toBe(1);
  });

  it("R-5: invalid min_confidence=abc falls back to default 0.65, returns 200", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet("http://localhost/api/signals?min_confidence=abc");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.min_confidence).toBe(0.65);
  });

  it("R-6: signals.jsonl not present — 200 + empty signals + freshness -1", async () => {
    const nonExistent = path.join(FIXTURE_DIR, "__never_exists__.jsonl");
    process.env.LM_SIGNALS_JSONL_PATH = nonExistent;
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signals).toEqual([]);
    expect(body.meta.source_freshness_sec).toBe(-1);
    expect(body.meta.total_active).toBe(0);
  });

  it("R-7: one broken json line — 200 with valid rows, stderr logged", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "mixed.jsonl");
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    // mixed.jsonl has: 1 valid (sig_ok), 1 broken JSON, 1 legacy (event_key=null, valid).
    // Both valid signals should return.
    expect(body.signals.length).toBeGreaterThanOrEqual(1);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("R-8: all lines broken — 503 with error body", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "all_corrupted.jsonl");
    const res = await invokeGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeDefined();
    errSpy.mockRestore();
  });

  it("R-9: default sort — confidence desc, created_at desc", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet();
    const body = await res.json();
    for (let i = 1; i < body.signals.length; i++) {
      const prev = body.signals[i - 1];
      const cur = body.signals[i];
      if (prev.confidence === cur.confidence) {
        expect(prev.created_at >= cur.created_at).toBe(true);
      } else {
        expect(prev.confidence).toBeGreaterThanOrEqual(cur.confidence);
      }
    }
  });

  it("R-10: limit=3 caps the returned signals", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet("http://localhost/api/signals?limit=3");
    const body = await res.json();
    expect(body.signals.length).toBeLessThanOrEqual(3);
  });

  it("R-11: cache-control and ETag headers are set", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet();
    expect(res.headers.get("cache-control")).toContain("max-age");
    const etag = res.headers.get("etag");
    expect(etag).toBeTruthy();
    // mtime-based weak ETag format: W/"sig-{mtime}-{count}"
    expect(etag).toMatch(/^W\/"sig-/);
  });

  it("R-12: primary_asset filter — returns only matching asset", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet("http://localhost/api/signals?primary_asset=BTC");
    const body = await res.json();
    for (const s of body.signals) expect(s.primary_asset).toBe("BTC");
  });
});
