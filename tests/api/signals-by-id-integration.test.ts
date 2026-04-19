/**
 * End-to-end integration: reader → cache → buildSignalDetailResponse → route.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-task-1-3-signal-detail-design.md §5.4.
 *
 * These tests exercise the full stack — readAndParseSignals pulls from disk,
 * the route handler's in-memory cache collapses duplicate reads, and the
 * buildSignalDetailResponse SSOT shapes the wire payload. Using vi.resetModules
 * in beforeEach ensures each test picks up a fresh env-var-driven jsonl path.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

async function setupJsonl(rows: string[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "task1-3-int-"));
  const file = path.join(dir, "signals.jsonl");
  await fs.writeFile(file, rows.join("\n") + (rows.length ? "\n" : ""), "utf8");
  process.env.LM_SIGNALS_JSONL_PATH = file;
  return file;
}

/**
 * Build a schema-valid Signal jsonl row. Mirrors tests/api/signals-by-id.test.ts
 * helper so zod validation inside readAndParseSignals passes. Overrides let
 * each test drive chain shape and ids.
 */
function row(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    id: "sig_default",
    trace_id: "trace_default",
    root_trace_id: "trace_default",
    schema_version: "1.1-beta",
    created_at: "2026-04-19T10:00:00+00:00",
    updated_at: "2026-04-19T10:00:00+00:00",
    type: "governance_event",
    subtype: "drep_vote",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem_default",
    event_key: "evt",
    confidence: 0.75,
    impact: "medium",
    urgency: 0.5,
    time_horizon: "1-2 weeks",
    direction: "positive",
    evidence: [],
    similar_cases: [],
    related_assets: [],
    related_protocols: [],
    tradable: false,
    headline_en: "headline en",
    headline_ja: "headline ja",
    summary_en: "summary en",
    summary_ja: "summary ja",
    source_ids: [],
    supersedes_signal_id: null,
    primary_asset: null,
    ...overrides,
  });
}

describe("integration: signals-by-id", () => {
  let orig: string | undefined;
  beforeEach(() => {
    orig = process.env.LM_SIGNALS_JSONL_PATH;
    // Reset module state so the route's in-memory cache doesn't leak between
    // tests driven by different env-var paths.
    vi.resetModules();
  });
  afterEach(() => {
    if (orig !== undefined) process.env.LM_SIGNALS_JSONL_PATH = orig;
    else delete process.env.LM_SIGNALS_JSONL_PATH;
  });

  it("end-to-end happy path: writes 3-row chain, requests newest, receives chain_status='ok'", async () => {
    await setupJsonl([
      row({
        id: "t1",
        trace_id: "t1",
        root_trace_id: "rr",
        updated_at: "2026-04-19T10:00:00+00:00",
        supersedes_signal_id: null,
        status: "superseded",
        idempotency_key: "idem_t1",
      }),
      row({
        id: "t2",
        trace_id: "t2",
        root_trace_id: "rr",
        updated_at: "2026-04-19T11:00:00+00:00",
        supersedes_signal_id: "t1",
        status: "superseded",
        idempotency_key: "idem_t2",
      }),
      row({
        id: "t3",
        trace_id: "t3",
        root_trace_id: "rr",
        updated_at: "2026-04-19T12:00:00+00:00",
        supersedes_signal_id: "t2",
        status: "active",
        idempotency_key: "idem_t3",
      }),
    ]);
    const { GET } = await import("@/app/api/signals/[id]/route");
    const res = await GET(new NextRequest("http://localhost/api/signals/t3"), {
      params: { id: "t3" },
    });
    const body = (await res.json()) as {
      chain_status: string;
      chain: Array<{ id: string }>;
      chain_integrity_warnings: string[];
    };
    expect(body.chain_status).toBe("ok");
    expect(body.chain.map((s) => s.id)).toEqual(["t1", "t2", "t3"]);
    expect(body.chain_integrity_warnings).toEqual([]);
  });

  it("end-to-end not-found: requests missing id, receives chain_status='not_found'", async () => {
    await setupJsonl([row({ id: "exists", trace_id: "exists" })]);
    const { GET } = await import("@/app/api/signals/[id]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/signals/ghost"),
      { params: { id: "ghost" } },
    );
    const body = (await res.json()) as {
      signal: unknown;
      chain_status: string;
      meta: { found: boolean };
    };
    expect(body.signal).toBeNull();
    expect(body.chain_status).toBe("not_found");
    expect(body.meta.found).toBe(false);
  });

  it("end-to-end legacy (root_trace_id null) rejected by parser, surfaces as not_found", async () => {
    // Plan intent was chain_status: "missing_root_trace". Per the existing
    // unit test R-3, that branch is unreachable end-to-end: the committed
    // zod schema declares root_trace_id as a required string and
    // coerceNullsToUndefined does NOT include it in OPTIONAL_NULLABLE. A
    // row with root_trace_id:null is therefore parse-rejected by the
    // reader and the signal never appears in allSignals, so the route
    // surfaces chain_status="not_found". The missing_root_trace branch in
    // buildSupersedeChain is still exercised by the reader unit tests
    // directly.
    await setupJsonl([
      row({
        id: "old",
        trace_id: "old",
        root_trace_id: null,
        supersedes_signal_id: null,
      }),
    ]);
    const { GET } = await import("@/app/api/signals/[id]/route");
    const res = await GET(new NextRequest("http://localhost/api/signals/old"), {
      params: { id: "old" },
    });
    const body = (await res.json()) as {
      chain_status: string;
      signal: unknown;
    };
    expect(body.chain_status).toBe("not_found");
    expect(body.signal).toBeNull();
  });
});
