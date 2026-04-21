import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { rejectIntent } from "@/scripts/reject-intent";
import { readRejectLog } from "@/lib/intents-reject";

let tmpDir: string;
let intentsPath: string;
let rejectLogPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rj-"));
  intentsPath = path.join(tmpDir, "tradeintents.jsonl");
  rejectLogPath = path.join(tmpDir, "intent-reject-log.jsonl");
});

function writeProposed(id: string) {
  const row = {
    intent_id: id,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    schema_version: "0.1-alpha",
    created_at: "2026-04-21T23:03:00Z",
    updated_at: "2026-04-21T23:03:00Z",
    status: "proposed",
    expires_at: "2099-01-01T00:00:00Z",
    source_signal_ids: ["sig_1", "sig_2"],
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
      summary_ja: "JA summary twenty plus chars here",
    },
    authored_via: "sde_auto_proposal",
    visibility: "private",
    proposer_metadata: {
      version: "v0.2-alpha-rule",
      cluster_fingerprint: "fp123456",
      generated_at: "2026-04-21T23:03:00Z",
    },
  };
  fs.appendFileSync(intentsPath, JSON.stringify(row) + "\n");
}

describe("rejectIntent", () => {
  it("transitions proposed → cancelled and appends reject log", async () => {
    writeProposed("int_proposed_0000000000000020");
    await rejectIntent({
      intentsJsonlPath: intentsPath,
      rejectLogJsonlPath: rejectLogPath,
      intentId: "int_proposed_0000000000000020",
      reason: "thesis_disagree",
      note: "Not a price-leading indicator",
      nowIso: "2026-04-22T05:30:00Z",
    });
    const rows = fs.readFileSync(intentsPath, "utf-8").split("\n").filter(Boolean);
    expect(rows).toHaveLength(2);
    const last = JSON.parse(rows[1]);
    expect(last.status).toBe("cancelled");
    expect(last.visibility).toBe("private");

    const log = readRejectLog(rejectLogPath);
    expect(log).toHaveLength(1);
    expect(log[0].reason).toBe("thesis_disagree");
    expect(log[0].note).toBe("Not a price-leading indicator");
    expect(log[0].cluster_fingerprint).toBe("fp123456");
    expect(log[0].intent_id).toBe("int_proposed_0000000000000020");
  });

  it("accepts r1-r8 numeric form", async () => {
    writeProposed("int_proposed_0000000000000021");
    await rejectIntent({
      intentsJsonlPath: intentsPath,
      rejectLogJsonlPath: rejectLogPath,
      intentId: "int_proposed_0000000000000021",
      reason: "r7",
      note: "disagree",
      nowIso: "2026-04-22T05:30:00Z",
    });
    const log = readRejectLog(rejectLogPath);
    expect(log[0].reason).toBe("thesis_disagree");
  });

  it("maps r1 through r8 correctly", async () => {
    const mappings = [
      { numeric: "r1", enum: "weak_invalidation" },
      { numeric: "r2", enum: "low_conviction" },
      { numeric: "r3", enum: "duplicate_of_approved" },
      { numeric: "r4", enum: "wrong_direction" },
      { numeric: "r5", enum: "stale_signals" },
      { numeric: "r6", enum: "out_of_scope" },
      { numeric: "r7", enum: "thesis_disagree" },
      { numeric: "r8", enum: "other" },
    ];
    for (let i = 0; i < mappings.length; i++) {
      const { numeric, enum: expectedEnum } = mappings[i];
      const intentId = `int_proposed_000000000000002${i.toString(16).padStart(1, "0")}`;
      writeProposed(intentId);
      await rejectIntent({
        intentsJsonlPath: intentsPath,
        rejectLogJsonlPath: rejectLogPath,
        intentId,
        reason: numeric,
        note: numeric === "r8" ? "required note" : undefined,
        nowIso: "2026-04-22T05:30:00Z",
      });
    }
    const log = readRejectLog(rejectLogPath);
    expect(log).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      expect(log[i].reason).toBe(mappings[i].enum);
    }
  });

  it("rejects when reason=other without note", async () => {
    writeProposed("int_proposed_000000000000002c");
    await expect(
      rejectIntent({
        intentsJsonlPath: intentsPath,
        rejectLogJsonlPath: rejectLogPath,
        intentId: "int_proposed_000000000000002c",
        reason: "other",
        note: undefined,
        nowIso: "2026-04-22T05:30:00Z",
      }),
    ).rejects.toThrow(/note.*required/i);
  });

  it("fails when intent not in proposed status", async () => {
    // Use a valid 16-char intent_id (regex: /^int_(proposed_)?[a-z0-9]{16}$/)
    // "approved00000000" is 16 chars (approved=8 + 8 zeros)
    const approvedId = "int_approved00000000";
    const row = {
      intent_id: approvedId,
      trace_id: "550e8400-e29b-41d4-a716-446655440000",
      schema_version: "0.1-alpha",
      created_at: "2026-04-21T23:03:00Z",
      updated_at: "2026-04-21T23:03:00Z",
      status: "approved",
      source_signal_ids: ["sig_1"],
      title: "x",
      description: "x description here",
      side: "accumulate",
      target_assets: ["ADA"],
      thesis: "x thesis long enough over twenty chars",
      why_now: "x why_now long enough over twenty chars",
      invalidation_thesis: "x inv long enough over twenty chars please",
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
        summary_en: "EN summary twenty plus chars here",
        summary_ja: "JA summary twenty plus chars here",
      },
      authored_via: "claude_code_dialogue",
      visibility: "public",
    };
    fs.appendFileSync(intentsPath, JSON.stringify(row) + "\n");

    await expect(
      rejectIntent({
        intentsJsonlPath: intentsPath,
        rejectLogJsonlPath: rejectLogPath,
        intentId: approvedId,
        reason: "r1",
        nowIso: "2026-04-22T05:30:00Z",
      }),
    ).rejects.toThrow(/not.*proposed|status/i);
  });

  it("fails on invalid reason string", async () => {
    writeProposed("int_proposed_000000000000002e");
    await expect(
      rejectIntent({
        intentsJsonlPath: intentsPath,
        rejectLogJsonlPath: rejectLogPath,
        intentId: "int_proposed_000000000000002e",
        reason: "invalid_reason",
        nowIso: "2026-04-22T05:30:00Z",
      }),
    ).rejects.toThrow(/invalid reason/i);
  });
});
