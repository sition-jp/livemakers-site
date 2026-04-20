// tests/api/intents-integration.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { createIntent } from "@/lib/intent-authoring";

describe("intents integration (authoring → reader → API)", () => {
  let tmpDir: string;
  let intentsPath: string;
  let signalsPath: string;
  const origIntents = process.env.LM_INTENTS_JSONL_PATH;
  const origSignals = process.env.LM_SIGNALS_JSONL_PATH;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-e2e-"));
    intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    signalsPath = path.join(tmpDir, "signals.jsonl");
    process.env.LM_INTENTS_JSONL_PATH = intentsPath;
    process.env.LM_SIGNALS_JSONL_PATH = signalsPath;
    // Seed one valid signal so createIntent's source_signal_ids check passes.
    fs.writeFileSync(
      signalsPath,
      JSON.stringify({
        id: "sig_001",
        trace_id: "trace_sig_001",
        root_trace_id: "trace_sig_001",
        schema_version: "1.1-beta",
        created_at: "2026-04-18T10:00:00Z",
        updated_at: "2026-04-18T10:00:00Z",
        type: "governance_event",
        subtype: "drep_vote",
        pillar: "governance_and_treasury",
        status: "active",
        idempotency_key: "idem_sig_001",
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
        headline_en: "Signal hl",
        headline_ja: "シグナル見出し",
        summary_en: "Signal summary.",
        summary_ja: "シグナル要約。",
        source_ids: [],
      }) + "\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (origIntents === undefined) delete process.env.LM_INTENTS_JSONL_PATH;
    else process.env.LM_INTENTS_JSONL_PATH = origIntents;
    if (origSignals === undefined) delete process.env.LM_SIGNALS_JSONL_PATH;
    else process.env.LM_SIGNALS_JSONL_PATH = origSignals;
  });

  it("E2E-1: createIntent → /api/intents list returns the new intent", async () => {
    const r = await createIntent(
      {
        source_signal_ids: ["sig_001"],
        title: "E2E intent",
        description: "End-to-end test description.",
        side: "accumulate",
        target_assets: ["ADA"],
        thesis: "E2E thesis sufficiently long to pass validation.",
        why_now: "Right now for end-to-end test purposes only.",
        invalidation_thesis:
          "Cancel if BTC weekly close drops below $55k level.",
        thesis_conviction: 0.7,
        execution_confidence: 0.5,
        priority: 0.5,
        preferred_horizon: "swing",
        portfolio_context: { bucket: "tactical" },
        display: {
          headline_en: "E2E EN",
          headline_ja: "E2E JA",
          summary_en: "E2E summary english text for integration testing.",
          summary_ja: "E2E 要約の日本語テキスト。十分な長さを確保。",
        },
      },
      { jsonlPath: intentsPath, knownSignalIds: new Set(["sig_001"]) },
    );

    vi.resetModules();
    const mod = await import("@/app/api/intents/route");
    const res = await mod.GET(new NextRequest("http://localhost/api/intents"));
    const body = await res.json();
    expect(body.intents).toHaveLength(1);
    expect(body.intents[0].intent_id).toBe(r.intent.intent_id);
  });

  it("E2E-2: createIntent → /api/intents/[id] returns detail with resolved signal", async () => {
    const r = await createIntent(
      {
        source_signal_ids: ["sig_001"],
        title: "E2E detail",
        description: "End-to-end detail test.",
        side: "accumulate",
        target_assets: ["ADA"],
        thesis: "Detail thesis sufficiently long to pass zod validation.",
        why_now: "Right now for detail test purposes.",
        invalidation_thesis: "Cancel if BTC weekly close < $55k threshold.",
        thesis_conviction: 0.7,
        execution_confidence: 0.5,
        priority: 0.5,
        preferred_horizon: "swing",
        portfolio_context: { bucket: "tactical" },
        display: {
          headline_en: "detail EN",
          headline_ja: "detail JA",
          summary_en: "detail summary english text for integration test.",
          summary_ja: "detail 要約の日本語テキスト。十分な長さを確保。",
        },
      },
      { jsonlPath: intentsPath, knownSignalIds: new Set(["sig_001"]) },
    );

    vi.resetModules();
    const mod = await import("@/app/api/intents/[id]/route");
    const req = new NextRequest(
      `http://localhost/api/intents/${r.intent.intent_id}`,
    );
    const res = await mod.GET(req, {
      params: Promise.resolve({ id: r.intent.intent_id }),
    });
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.intent.intent_id).toBe(r.intent.intent_id);
    expect(body.source_signals).toHaveLength(1);
    expect(body.source_signals[0].id).toBe("sig_001");
  });

  it("E2E-3: createIntent → Signal detail returns referencing_intent_ids", async () => {
    const r = await createIntent(
      {
        source_signal_ids: ["sig_001"],
        title: "E2E backlink",
        description: "End-to-end backlink test.",
        side: "accumulate",
        target_assets: ["ADA"],
        thesis: "Backlink thesis sufficiently long to pass zod validation.",
        why_now: "Right now for backlink test purposes.",
        invalidation_thesis: "Cancel if BTC weekly close < $55k.",
        thesis_conviction: 0.7,
        execution_confidence: 0.5,
        priority: 0.5,
        preferred_horizon: "swing",
        portfolio_context: { bucket: "tactical" },
        display: {
          headline_en: "backlink EN",
          headline_ja: "backlink JA",
          summary_en: "backlink summary english text for integration test.",
          summary_ja: "backlink 要約の日本語テキスト。十分な長さを確保。",
        },
      },
      { jsonlPath: intentsPath, knownSignalIds: new Set(["sig_001"]) },
    );

    vi.resetModules();
    const mod = await import("@/app/api/signals/[id]/route");
    const req = new NextRequest("http://localhost/api/signals/sig_001");
    const res = await mod.GET(req, {
      params: Promise.resolve({ id: "sig_001" }),
    });
    const body = await res.json();
    expect(body.referencing_intent_ids).toEqual([r.intent.intent_id]);
  });
});
