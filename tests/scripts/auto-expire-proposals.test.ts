import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runAutoExpire } from "@/scripts/auto-expire-proposals";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ae-"));
});

function writeProposed(intentsPath: string, id: string, createdAt: string) {
  const row = {
    intent_id: id,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    schema_version: "0.1-alpha",
    created_at: createdAt,
    updated_at: createdAt,
    status: "proposed",
    expires_at: "2099-01-01T00:00:00Z",
    source_signal_ids: ["sig_1"],
    title: "test", description: "test description here",
    side: "accumulate", target_assets: ["ADA"],
    thesis: "test thesis long enough over twenty chars",
    why_now: "test why_now long enough over twenty chars",
    invalidation_thesis: "test invalidation long enough over twenty chars",
    thesis_conviction: 0.7, execution_confidence: 0.4, priority: 0.5,
    preferred_horizon: "position", portfolio_context: { bucket: "core" },
    human_review: { required: true },
    display: {
      headline_en: "", headline_ja: "JA headline test",
      summary_en: "", summary_ja: "JA summary test with twenty plus chars here"
    },
    authored_via: "sde_auto_proposal", visibility: "private",
    proposer_metadata: {
      version: "v0.2-alpha-rule",
      cluster_fingerprint: "fp-" + id,
      generated_at: createdAt,
    },
  };
  fs.appendFileSync(intentsPath, JSON.stringify(row) + "\n");
}

describe("runAutoExpire", () => {
  it("expires 24h+ proposed intent with skip_then_timeout from touch store", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const expiryPath = path.join(tmpDir, "intent-expiry-log.jsonl");
    const touchPath = path.join(tmpDir, "review-gate-touches.json");

    const oldId = "int_proposed_0000000000000001";
    writeProposed(intentsPath, oldId, "2026-04-20T09:00:00Z");
    fs.writeFileSync(
      touchPath,
      JSON.stringify({
        [oldId]: { skip_count: 1, last_seen_at: "2026-04-21T05:15:00Z" },
      }),
    );

    const result = await runAutoExpire({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryPath,
      touchStorePath: touchPath,
      nowIso: "2026-04-22T10:00:00Z",
    });

    expect(result.expired).toEqual([oldId]);
    const logRaw = fs.readFileSync(expiryPath, "utf-8").trim();
    expect(logRaw).toContain("skip_then_timeout");
    expect(logRaw).toContain('"skip_count":1');
    expect(logRaw).toContain("2026-04-21T05:15:00Z");
  });

  it("no-op when nothing to expire", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const expiryPath = path.join(tmpDir, "intent-expiry-log.jsonl");
    const touchPath = path.join(tmpDir, "review-gate-touches.json");
    fs.writeFileSync(intentsPath, "");
    const result = await runAutoExpire({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryPath,
      touchStorePath: touchPath,
      nowIso: "2026-04-22T10:00:00Z",
    });
    expect(result.expired).toEqual([]);
  });

  it("returns timed_out_without_review when touch store has no record", async () => {
    const intentsPath = path.join(tmpDir, "tradeintents.jsonl");
    const expiryPath = path.join(tmpDir, "intent-expiry-log.jsonl");
    const touchPath = path.join(tmpDir, "review-gate-touches.json");

    const noSkipId = "int_proposed_000000000000002a";
    writeProposed(intentsPath, noSkipId, "2026-04-20T09:00:00Z");
    // No touch entry for this intent

    const result = await runAutoExpire({
      intentsJsonlPath: intentsPath,
      expiryLogJsonlPath: expiryPath,
      touchStorePath: touchPath,
      nowIso: "2026-04-22T10:00:00Z",
    });
    expect(result.expired).toEqual([noSkipId]);
    const logRaw = fs.readFileSync(expiryPath, "utf-8").trim();
    expect(logRaw).toContain("timed_out_without_review");
  });
});
