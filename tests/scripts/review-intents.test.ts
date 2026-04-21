import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { buildReviewDump } from "@/scripts/review-intents";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rv-"));
});

function writeProposed(intentsPath: string, id: string, sourceIds: string[]) {
  const row = {
    intent_id: id,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    schema_version: "0.1-alpha",
    created_at: "2026-04-21T23:03:00Z",
    updated_at: "2026-04-21T23:03:00Z",
    status: "proposed",
    expires_at: "2099-01-01T00:00:00Z",
    source_signal_ids: sourceIds,
    title: "test title",
    description: "test description here",
    side: "accumulate",
    target_assets: ["ADA"],
    thesis: "test thesis long enough over twenty chars",
    why_now: "test why_now long enough over twenty chars",
    invalidation_thesis: "test invalidation long enough over twenty chars",
    thesis_conviction: 0.7,
    execution_confidence: 0.4,
    priority: 0.5,
    preferred_horizon: "position",
    portfolio_context: { bucket: "core" },
    human_review: { required: true },
    display: {
      headline_en: "",
      headline_ja: "JA headline test",
      summary_en: "",
      summary_ja: "JA summary test with twenty plus chars here",
    },
    authored_via: "sde_auto_proposal",
    visibility: "private",
    proposer_metadata: {
      version: "v0.2-alpha-rule",
      cluster_fingerprint: "fp_" + id,
      generated_at: "2026-04-21T23:03:00Z",
    },
  };
  fs.appendFileSync(intentsPath, JSON.stringify(row) + "\n");
}

function writeSignal(
  signalsPath: string,
  id: string,
  status: string,
  createdAt = "2026-04-21T12:00:00Z",
) {
  const row = {
    id,
    trace_id: "t",
    root_trace_id: "rt",
    schema_version: "1.1-beta",
    event_key: "x|y",
    status,
    created_at: createdAt,
    type: "governance_shift",
    subtype: "drep",
    pillar: "governance_and_treasury",
    idempotency_key: "idem-" + id,
    confidence: 0.78,
    impact: "high",
    urgency: 0.5,
    time_horizon: "months",
    direction: "positive",
    primary_asset: "ADA",
    related_assets: ["ADA"],
    related_protocols: [],
    tradable: true,
    position_hint: { stance: "accumulate", conviction: 0.7 },
    evidence: [],
    similar_cases: [],
    headline_en: "h",
    headline_ja: "h",
    summary_en: "s",
    summary_ja: "s",
    source_ids: [],
  };
  fs.appendFileSync(signalsPath, JSON.stringify(row) + "\n");
}

describe("buildReviewDump", () => {
  it("returns empty pending when no proposed intents", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const signalsPath = path.join(tmpDir, "signals.jsonl");
    const runLogPath = path.join(tmpDir, "proposer-run-log.jsonl");
    fs.writeFileSync(intentsPath, "");
    fs.writeFileSync(signalsPath, "");
    const dump = await buildReviewDump({
      intentsJsonlPath: intentsPath,
      signalsJsonlPath: signalsPath,
      runLogJsonlPath: runLogPath,
      nowIso: "2026-04-22T05:15:00Z",
    });
    expect(dump.pending).toEqual([]);
    expect(dump.total_pending).toBe(0);
  });

  it("returns pending with stale_source_signals when source sig becomes invalidated", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const signalsPath = path.join(tmpDir, "signals.jsonl");
    const runLogPath = path.join(tmpDir, "proposer-run-log.jsonl");
    writeProposed(intentsPath, "int_proposed_0000000000000001", ["sig_1", "sig_2"]);
    writeSignal(signalsPath, "sig_1", "active");
    writeSignal(signalsPath, "sig_2", "invalidated");

    const dump = await buildReviewDump({
      intentsJsonlPath: intentsPath,
      signalsJsonlPath: signalsPath,
      runLogJsonlPath: runLogPath,
      nowIso: "2026-04-22T05:15:00Z",
    });
    expect(dump.pending).toHaveLength(1);
    expect(dump.pending[0].stale_source_signals).toHaveLength(1);
    expect(dump.pending[0].stale_source_signals[0].signal_id).toBe("sig_2");
    expect(dump.pending[0].stale_source_signals[0].status_now).toBe("invalidated");
  });

  it("includes proposer_last_run from run-log", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const signalsPath = path.join(tmpDir, "signals.jsonl");
    const runLogPath = path.join(tmpDir, "proposer-run-log.jsonl");
    fs.writeFileSync(intentsPath, "");
    fs.writeFileSync(signalsPath, "");
    const runEntry = {
      run_id: "r1",
      run_at: "2026-04-21T23:03:00Z",
      proposer_version: "v0.2-alpha-rule",
      status: "ok",
      clusters_detected: 3,
      clusters_after_dedupe: 2,
      proposals_created: 2,
      mixed_skipped: 0,
    };
    fs.writeFileSync(runLogPath, JSON.stringify(runEntry) + "\n");
    const dump = await buildReviewDump({
      intentsJsonlPath: intentsPath,
      signalsJsonlPath: signalsPath,
      runLogJsonlPath: runLogPath,
      nowIso: "2026-04-22T05:15:00Z",
    });
    expect(dump.proposer_last_run?.status).toBe("ok");
    expect(dump.proposer_last_run?.proposals_created).toBe(2);
  });

  it("computes hours_since_created and hours_until_expiry per card", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const signalsPath = path.join(tmpDir, "signals.jsonl");
    const runLogPath = path.join(tmpDir, "proposer-run-log.jsonl");
    writeProposed(intentsPath, "int_proposed_0000000000000002", ["sig_x"]);
    writeSignal(signalsPath, "sig_x", "active");
    // created_at = 2026-04-21T23:03:00Z, nowIso = 2026-04-22T05:03:00Z → 6h since created
    const dump = await buildReviewDump({
      intentsJsonlPath: intentsPath,
      signalsJsonlPath: signalsPath,
      runLogJsonlPath: runLogPath,
      nowIso: "2026-04-22T05:03:00Z",
    });
    expect(dump.pending[0].hours_since_created).toBe(6);
    expect(dump.pending[0].hours_until_expiry).toBe(18); // 24h - 6h
  });

  it("filters to sde_auto_proposal intents only", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const signalsPath = path.join(tmpDir, "signals.jsonl");
    const runLogPath = path.join(tmpDir, "proposer-run-log.jsonl");
    // Human-authored proposed (rare but possible) should NOT appear
    const humanRow = {
      intent_id: "int_human0000001f",
      trace_id: "t",
      schema_version: "0.1-alpha",
      created_at: "2026-04-21T23:03:00Z",
      updated_at: "2026-04-21T23:03:00Z",
      status: "proposed",
      expires_at: "2099-01-01T00:00:00Z",
      source_signal_ids: ["sig_x"],
      title: "human",
      description: "human description here",
      side: "accumulate",
      target_assets: ["ADA"],
      thesis: "human thesis long enough over twenty chars",
      why_now: "human why_now long enough over twenty chars",
      invalidation_thesis: "human inv long enough over twenty chars please",
      thesis_conviction: 0.7,
      execution_confidence: 0.4,
      priority: 0.5,
      preferred_horizon: "position",
      portfolio_context: { bucket: "core" },
      human_review: {
        required: true,
        approved_by: "x",
        approved_at: "2026-04-21T23:03:00Z",
      },
      display: {
        headline_en: "EN",
        headline_ja: "JA",
        summary_en: "EN summary with twenty plus chars here",
        summary_ja: "JA summary test with twenty plus chars here",
      },
      authored_via: "claude_code_dialogue",
      visibility: "public",
    };
    fs.appendFileSync(intentsPath, JSON.stringify(humanRow) + "\n");
    writeSignal(signalsPath, "sig_x", "active");

    const dump = await buildReviewDump({
      intentsJsonlPath: intentsPath,
      signalsJsonlPath: signalsPath,
      runLogJsonlPath: runLogPath,
      nowIso: "2026-04-22T05:15:00Z",
    });
    expect(dump.pending).toHaveLength(0); // human intent excluded
  });
});
