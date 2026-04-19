import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";

/**
 * Integration smoke tests — exercise the full
 *   reader → cache → route
 * stack as a single unit. These use filesystem fixtures (not mocks) and
 * check end-to-end behavior: that a reader parse result propagates through
 * the cache, that query params produce the expected filter+sort order in
 * the final JSON, and that the real production signals.jsonl (when present)
 * round-trips without hard errors.
 *
 * Why separate from signals.test.ts: the unit file focuses on HTTP contract
 * edge cases (status codes, error paths, header shape). This file asserts
 * that the pieces compose correctly on the happy path — the "does the
 * whole thing work" question.
 */

const FIXTURE_DIR = path.join(__dirname, "../fixtures/signals");
const origEnv = process.env.LM_SIGNALS_JSONL_PATH;

async function invokeGet(url = "http://localhost/api/signals") {
  const { GET } = await import("@/app/api/signals/route");
  const req = new Request(url);
  return GET(req);
}

describe("signals — integration (reader → cache → route)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (origEnv === undefined) delete process.env.LM_SIGNALS_JSONL_PATH;
    else process.env.LM_SIGNALS_JSONL_PATH = origEnv;
  });

  it("INT-1: valid fixture → sorted by confidence desc, headline+summary intact", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const body = await res.json();

    // Shape check
    expect(body.meta).toMatchObject({
      min_confidence: 0.65,
      returned: expect.any(Number),
      total_active: expect.any(Number),
      generated_at: expect.any(String),
      source_freshness_sec: expect.any(Number),
    });

    // Top signal should be sig_001 (0.85) — strongest confidence in the
    // fixture that passes the default 0.65 gate.
    expect(body.signals[0].id).toBe("sig_001");
    // Headline + summary round-trip: parsed through zod, serialized to
    // JSON, back through fetch — no data loss.
    expect(body.signals[0].headline_ja).toContain("Cardano");
    expect(body.signals[0].evidence.length).toBeGreaterThan(0);
  });

  it("INT-2: supersede fixture — latest-row-wins survives the whole stack", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(
      FIXTURE_DIR,
      "supersede.jsonl"
    );
    const res = await invokeGet("http://localhost/api/signals?min_confidence=0");
    const body = await res.json();
    // sig_X should surface in its final superseded state (not its earlier
    // active snapshot); sig_Y should surface as active with the supersedes
    // pointer set.
    const sigX = body.signals.find((s: any) => s.id === "sig_X");
    const sigY = body.signals.find((s: any) => s.id === "sig_Y");
    expect(sigX?.status).toBe("superseded");
    expect(sigY?.status).toBe("active");
    expect(sigY?.supersedes_signal_id).toBe("sig_X");
    // root_trace_id preserved across the supersede chain (spec §6.5)
    expect(sigY?.root_trace_id).toBe(sigX?.root_trace_id);
  });

  it("INT-3: bucket=actionable end-to-end — only critical/high-impact + 0.8+ conf survive", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const res = await invokeGet(
      "http://localhost/api/signals?bucket=actionable"
    );
    const body = await res.json();
    for (const s of body.signals) {
      expect(s.status).toBe("active");
      expect(s.confidence).toBeGreaterThanOrEqual(0.8);
      expect(["high", "critical"]).toContain(s.impact);
    }
    // valid fixture has sig_001 (0.85 / high) and no other actionable
    expect(body.signals.map((s: any) => s.id)).toEqual(["sig_001"]);
  });

  it("INT-4: real production signals.jsonl — 200 with non-empty meta (skipped if absent)", async () => {
    // This is the smoke test the spec §10 completion criterion calls out:
    // "実 signals.jsonl で dev 起動確認、3 バケットがレンダリングされる".
    // We can't launch dev from a unit test, but we CAN assert that the
    // API route composes cleanly against the real file shape — catching
    // schema drift between SDE and LM before it hits production.
    const monorepoRoot = path.resolve(__dirname, "../../../..");
    const realPath = path.join(
      monorepoRoot,
      "07_DATA/content/intelligence/signals.jsonl"
    );
    if (!fs.existsSync(realPath)) {
      return; // silent skip in CI / fresh clones
    }
    process.env.LM_SIGNALS_JSONL_PATH = realPath;
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    // There should be at least one parseable signal (29 at time of writing)
    expect(body.meta.total_active).toBeGreaterThan(0);
    // Every returned signal must have the required schema fields
    for (const s of body.signals) {
      expect(s.id).toBeTruthy();
      expect(s.schema_version).toBe("1.1-beta");
      expect(s.confidence).toBeGreaterThanOrEqual(0.65); // default filter
      expect(["active", "expired", "invalidated", "superseded"]).toContain(
        s.status
      );
    }
  });

  it("INT-5: ETag round-trip — second request with If-None-Match returns 304", async () => {
    process.env.LM_SIGNALS_JSONL_PATH = path.join(FIXTURE_DIR, "valid.jsonl");
    const first = await invokeGet();
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();

    const { GET } = await import("@/app/api/signals/route");
    const req = new Request("http://localhost/api/signals", {
      headers: { "if-none-match": etag! },
    });
    const second = await GET(req);
    expect(second.status).toBe(304);
    expect(second.headers.get("etag")).toBe(etag);
  });
});
