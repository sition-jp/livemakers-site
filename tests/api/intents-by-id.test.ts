import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

async function callRoute(id: string, extraHeaders: Record<string, string> = {}) {
  vi.resetModules();
  const mod = await import("@/app/api/intents/[id]/route");
  const req = new NextRequest(`http://localhost/api/intents/${id}`, {
    headers: extraHeaders,
  });
  const res = await mod.GET(req, { params: Promise.resolve({ id }) });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body, headers: res.headers };
}

function intentLine(overrides: Record<string, unknown> = {}): string {
  return (
    JSON.stringify({
      intent_id: "int_0000000000000001",
      trace_id: "00000000-0000-4000-8000-000000000001",
      schema_version: "0.1-alpha",
      created_at: "2026-04-20T09:00:00Z",
      updated_at: "2026-04-20T09:00:00Z",
      status: "approved",
      source_signal_ids: ["sig_001"],
      title: "T",
      description: "D",
      side: "accumulate",
      target_assets: ["ADA"],
      thesis: "Thesis long enough to pass validation.",
      why_now: "Why now reason sufficiently long.",
      invalidation_thesis: "Cancel if BTC weekly close < $55k.",
      thesis_conviction: 0.7,
      execution_confidence: 0.5,
      priority: 0.5,
      preferred_horizon: "swing",
      portfolio_context: { bucket: "tactical" },
      human_review: {
        required: true,
        approved_by: "LiveMakers Terminal",
        approved_at: "2026-04-20T09:00:00Z",
      },
      display: {
        headline_en: "E",
        headline_ja: "J",
        summary_en: "Summary long enough to pass.",
        summary_ja: "十分長い要約の日本語サンプル文字列です。これでバリデーション通過。",
      },
      visibility: "public",
      authored_via: "claude_code_dialogue",
      ...overrides,
    }) + "\n"
  );
}

function signalLine(id: string): string {
  return (
    JSON.stringify({
      id,
      trace_id: "trace_" + id,
      root_trace_id: "trace_" + id,
      schema_version: "1.1-beta",
      created_at: "2026-04-18T10:00:00Z",
      updated_at: "2026-04-18T10:00:00Z",
      type: "governance_event",
      subtype: "drep_vote",
      pillar: "governance_and_treasury",
      status: "active",
      idempotency_key: "idem_" + id,
      confidence: 0.8,
      impact: "high",
      urgency: 0.7,
      time_horizon: "1-2 weeks",
      direction: "positive",
      evidence: [],
      similar_cases: [],
      related_assets: ["ADA"],
      related_protocols: [],
      primary_asset: "ADA",
      tradable: false,
      headline_en: "hl en",
      headline_ja: "hl ja",
      summary_en: "sum en",
      summary_ja: "sum ja",
      source_ids: [],
    }) + "\n"
  );
}

describe("GET /api/intents/[id]", () => {
  let tmpDir: string;
  let intentsPath: string;
  let signalsPath: string;
  const origIntents = process.env.LM_INTENTS_JSONL_PATH;
  const origSignals = process.env.LM_SIGNALS_JSONL_PATH;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-intents-detail-"));
    intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    signalsPath = path.join(tmpDir, "signals.jsonl");
    process.env.LM_INTENTS_JSONL_PATH = intentsPath;
    process.env.LM_SIGNALS_JSONL_PATH = signalsPath;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (origIntents === undefined) delete process.env.LM_INTENTS_JSONL_PATH;
    else process.env.LM_INTENTS_JSONL_PATH = origIntents;
    if (origSignals === undefined) delete process.env.LM_SIGNALS_JSONL_PATH;
    else process.env.LM_SIGNALS_JSONL_PATH = origSignals;
  });

  it("R2-1: returns 200 + intent + resolved source_signals", async () => {
    fs.writeFileSync(intentsPath, intentLine());
    fs.writeFileSync(signalsPath, signalLine("sig_001"));
    const { status, body } = await callRoute("int_0000000000000001");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.intent.intent_id).toBe("int_0000000000000001");
    expect(body.source_signals).toHaveLength(1);
    expect(body.source_signals[0].id).toBe("sig_001");
    expect(body.source_signals_missing).toEqual([]);
    expect(body.meta.found).toBe(true);
  });

  it("R2-2: missing id returns 200 + status=not_found", async () => {
    fs.writeFileSync(intentsPath, intentLine());
    const { status, body } = await callRoute("int_ghost");
    expect(status).toBe(200);
    expect(body.status).toBe("not_found");
    expect(body.intent).toBeNull();
    expect(body.meta.found).toBe(false);
  });

  it("R2-3: source signal missing is pushed to source_signals_missing", async () => {
    fs.writeFileSync(
      intentsPath,
      intentLine({ source_signal_ids: ["sig_ghost"] }),
    );
    fs.writeFileSync(signalsPath, "");
    const { body } = await callRoute("int_0000000000000001");
    expect(body.status).toBe("ok");
    expect(body.source_signals).toEqual([]);
    expect(body.source_signals_missing).toEqual(["sig_ghost"]);
  });

  it("R2-4: etag keyed to intent id + mtime", async () => {
    fs.writeFileSync(intentsPath, intentLine());
    const { headers } = await callRoute("int_0000000000000001");
    expect(headers.get("etag")).toMatch(
      /^W\/"intent-detail-int_0000000000000001-\d+"$/,
    );
  });

  it("R2-5: If-None-Match match returns 304", async () => {
    fs.writeFileSync(intentsPath, intentLine());
    const first = await callRoute("int_0000000000000001");
    const etag = first.headers.get("etag") ?? "";
    const second = await callRoute("int_0000000000000001", {
      "if-none-match": etag,
    });
    expect(second.status).toBe(304);
  });

  it("R2-6: non-public visibility surfaces as not_found", async () => {
    fs.writeFileSync(intentsPath, intentLine({ visibility: "private" }));
    const { body } = await callRoute("int_0000000000000001");
    expect(body.status).toBe("not_found");
  });

  it("R2-7: 503 when reader I/O error", async () => {
    const fake = path.join(tmpDir, "file");
    fs.writeFileSync(fake, "blocker");
    process.env.LM_INTENTS_JSONL_PATH = path.join(fake, "tradeintents.jsonl");
    const { status, body } = await callRoute("int_0000000000000001");
    expect(status).toBe(503);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("R2-8: Cache-Control max-age 30 s-maxage 60 swr 120", async () => {
    fs.writeFileSync(intentsPath, intentLine());
    const { headers } = await callRoute("int_0000000000000001");
    const cc = headers.get("cache-control") ?? "";
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=30");
    expect(cc).toContain("s-maxage=60");
    expect(cc).toContain("stale-while-revalidate=120");
  });

  it("R2-9: archived status still returns intent (visibility public)", async () => {
    fs.writeFileSync(
      intentsPath,
      intentLine({ status: "archived" }),
    );
    const { body } = await callRoute("int_0000000000000001");
    expect(body.status).toBe("ok");
    expect(body.intent.status).toBe("archived");
  });

  it("R2-10: empty source_signals when no signal file exists", async () => {
    fs.writeFileSync(intentsPath, intentLine());
    // no signals.jsonl written
    const { body } = await callRoute("int_0000000000000001");
    expect(body.source_signals).toEqual([]);
    expect(body.source_signals_missing).toEqual(["sig_001"]);
  });
});
