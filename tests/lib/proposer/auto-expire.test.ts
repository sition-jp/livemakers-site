import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { autoExpirePendingProposals } from "@/lib/proposer/auto-expire";
import { readAndParseIntents } from "@/lib/intents-reader";
import { readExpiryLog } from "@/lib/intents-expiry";

let tmpDir: string;
let intentsPath: string;
let expiryLogPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "expire-"));
  intentsPath = path.join(tmpDir, "tradeintents.jsonl");
  expiryLogPath = path.join(tmpDir, "intent-expiry-log.jsonl");
});

function writeProposedIntent(id: string, createdAt: string) {
  const base = {
    intent_id: id,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    schema_version: "0.1-alpha",
    created_at: createdAt,
    updated_at: createdAt,
    status: "proposed",
    expires_at: "2099-01-01T00:00:00Z",
    source_signal_ids: ["sig_1"],
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
      cluster_fingerprint: id + "fingerprint",
      generated_at: createdAt,
    },
  };
  fs.appendFileSync(intentsPath, JSON.stringify(base) + "\n");
}

describe("autoExpirePendingProposals", () => {
  it("does nothing when no intent is older than 24h", () => {
    const now = "2026-04-21T10:00:00Z";
    writeProposedIntent("int_proposed_0000000000000001", "2026-04-21T01:00:00Z"); // 9h old
    const result = autoExpirePendingProposals({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryLogPath,
      nowIso: now,
      expireAfterHours: 24,
      skipCountLookup: () => 0,
    });
    expect(result.expired).toEqual([]);
  });

  it("expires intent older than 24h (timed_out_without_review)", () => {
    const now = "2026-04-22T10:00:00Z";
    writeProposedIntent("int_proposed_000000000000001a", "2026-04-21T09:00:00Z"); // 25h old
    const result = autoExpirePendingProposals({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryLogPath,
      nowIso: now,
      expireAfterHours: 24,
      skipCountLookup: () => 0,
    });
    expect(result.expired).toEqual(["int_proposed_000000000000001a"]);

    const { intents: allIntents } = readAndParseIntents(intentsPath);
    const finalForId = allIntents.filter(
      (i) => i.intent_id === "int_proposed_000000000000001a",
    );
    expect(finalForId[finalForId.length - 1].status).toBe("expired");

    const log = readExpiryLog(expiryLogPath);
    expect(log).toHaveLength(1);
    expect(log[0].reason).toBe("timed_out_without_review");
    expect(log[0].skip_count).toBe(0);
  });

  it("expired reason=skip_then_timeout when skip_count > 0", () => {
    const now = "2026-04-23T00:00:00Z";
    writeProposedIntent("int_proposed_000000000000001b", "2026-04-21T23:00:00Z"); // 25h old
    const result = autoExpirePendingProposals({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryLogPath,
      nowIso: now,
      expireAfterHours: 24,
      skipCountLookup: () => 2,
      lastSeenLookup: () => "2026-04-22T05:15:00Z",
    });
    expect(result.expired).toEqual(["int_proposed_000000000000001b"]);
    const log = readExpiryLog(expiryLogPath);
    expect(log[0].reason).toBe("skip_then_timeout");
    expect(log[0].skip_count).toBe(2);
    expect(log[0].last_seen_at_review_gate).toBe("2026-04-22T05:15:00Z");
  });

  it("does not re-expire an already-expired intent", () => {
    const now = "2026-04-23T00:00:00Z";
    writeProposedIntent("int_proposed_000000000000001c", "2026-04-20T00:00:00Z");
    // Manually append expired row
    const expiredRow = {
      intent_id: "int_proposed_000000000000001c",
      trace_id: "550e8400-e29b-41d4-a716-446655440000",
      schema_version: "0.1-alpha",
      created_at: "2026-04-20T00:00:00Z",
      updated_at: "2026-04-21T00:00:00Z",
      status: "expired",
      expires_at: "2099-01-01T00:00:00Z",
      source_signal_ids: ["sig_1"],
      title: "test",
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
        headline_ja: "JA",
        summary_en: "",
        summary_ja: "JA summary test with twenty plus chars here",
      },
      authored_via: "sde_auto_proposal",
      visibility: "private",
      proposer_metadata: {
        version: "v0.2-alpha-rule",
        cluster_fingerprint: "fp",
        generated_at: "2026-04-20T00:00:00Z",
      },
    };
    fs.appendFileSync(intentsPath, JSON.stringify(expiredRow) + "\n");

    const result = autoExpirePendingProposals({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryLogPath,
      nowIso: now,
      expireAfterHours: 24,
      skipCountLookup: () => 0,
    });
    expect(result.expired).toEqual([]); // latest row is expired; should not re-expire
  });

  it("skips non-sde_auto_proposal intents", () => {
    // Manually append a human-authored proposed intent (authored_via=claude_code_dialogue)
    const humanRow = {
      intent_id: "int_human0000001",
      trace_id: "550e8400-e29b-41d4-a716-446655440000",
      schema_version: "0.1-alpha",
      created_at: "2026-04-20T09:00:00Z",
      updated_at: "2026-04-20T09:00:00Z",
      status: "proposed", // rare but possible
      expires_at: "2099-01-01T00:00:00Z",
      source_signal_ids: ["sig_1"],
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
        approved_at: "2026-04-20T09:00:00Z",
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

    const result = autoExpirePendingProposals({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryLogPath,
      nowIso: "2026-04-22T10:00:00Z",
      expireAfterHours: 24,
      skipCountLookup: () => 0,
    });
    expect(result.expired).toEqual([]);
  });
});
