import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

async function callSignalRoute(id: string) {
  vi.resetModules();
  const mod = await import("@/app/api/signals/[id]/route");
  const req = new NextRequest(`http://localhost/api/signals/${id}`);
  const res = await mod.GET(req, { params: Promise.resolve({ id }) });
  const body = await res.json();
  return { status: res.status, body };
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

function intentLine(intent_id: string, source_signal_ids: string[]): string {
  return (
    JSON.stringify({
      intent_id,
      trace_id: `00000000-0000-4000-8000-${intent_id.slice(-12).padStart(12, "0")}`,
      schema_version: "0.1-alpha",
      created_at: "2026-04-20T09:00:00Z",
      updated_at: "2026-04-20T09:00:00Z",
      status: "approved",
      source_signal_ids,
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
    }) + "\n"
  );
}

describe("GET /api/signals/[id] — referencing_intent_ids backlink", () => {
  let tmpDir: string;
  let intentsPath: string;
  let signalsPath: string;
  const origIntents = process.env.LM_INTENTS_JSONL_PATH;
  const origSignals = process.env.LM_SIGNALS_JSONL_PATH;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-backlink-"));
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

  it("BK-1: signal with no referencing intents returns empty array", async () => {
    fs.writeFileSync(signalsPath, signalLine("sig_001"));
    fs.writeFileSync(intentsPath, "");
    const { status, body } = await callSignalRoute("sig_001");
    expect(status).toBe(200);
    expect(body.referencing_intent_ids).toEqual([]);
  });

  it("BK-2: one Intent referencing the signal is listed", async () => {
    fs.writeFileSync(signalsPath, signalLine("sig_001"));
    fs.writeFileSync(
      intentsPath,
      intentLine("int_0000000000000001", ["sig_001"]),
    );
    const { body } = await callSignalRoute("sig_001");
    expect(body.referencing_intent_ids).toEqual(["int_0000000000000001"]);
  });

  it("BK-3: multiple Intents referencing the signal are all listed", async () => {
    fs.writeFileSync(signalsPath, signalLine("sig_001"));
    fs.writeFileSync(
      intentsPath,
      intentLine("int_0000000000000001", ["sig_001"]) +
        intentLine("int_0000000000000002", ["sig_001", "sig_002"]),
    );
    const { body } = await callSignalRoute("sig_001");
    expect(body.referencing_intent_ids.sort()).toEqual([
      "int_0000000000000001",
      "int_0000000000000002",
    ]);
  });

  it("BK-4: Intents I/O error (ENOTDIR) — signal still returns 200 with empty referencing_intent_ids", async () => {
    fs.writeFileSync(signalsPath, signalLine("sig_001"));
    // Force ENOTDIR on the intents path
    const blocker = path.join(tmpDir, "blocker");
    fs.writeFileSync(blocker, "x");
    process.env.LM_INTENTS_JSONL_PATH = path.join(blocker, "tradeintents.jsonl");
    const { status, body } = await callSignalRoute("sig_001");
    expect(status).toBe(200);
    expect(body.referencing_intent_ids).toEqual([]);
  });

  it("BK-5: Signals read throw — still 503 regardless of intents state", async () => {
    // Lock in the contract that if the signals read itself throws, the route
    // returns 503, independent of intents state. The production signals-reader
    // swallows I/O errors internally (returns empty result), so we mock the
    // module to force a throw and exercise the narrow try-boundary in the route.
    fs.writeFileSync(intentsPath, "");
    fs.writeFileSync(signalsPath, signalLine("sig_001"));
    vi.resetModules();
    vi.doMock("@/lib/signals-reader", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/signals-reader")
      >("@/lib/signals-reader");
      return {
        ...actual,
        readAndParseSignals: () => {
          throw new Error("simulated signals read failure");
        },
      };
    });
    const mod = await import("@/app/api/signals/[id]/route");
    const req = new NextRequest(`http://localhost/api/signals/sig_001`);
    const res = await mod.GET(req, { params: Promise.resolve({ id: "sig_001" }) });
    const body = await res.json();
    vi.doUnmock("@/lib/signals-reader");
    expect(res.status).toBe(503);
    expect(body.error).toMatch(/unavailable/i);
  });
});
