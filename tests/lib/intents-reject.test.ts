import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  IntentRejectEntrySchema,
  RejectReasonSchema,
  readRejectLog,
  appendRejectEntry,
  type IntentRejectEntry,
} from "@/lib/intents-reject";

let tmpDir: string;
let logPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reject-log-"));
  logPath = path.join(tmpDir, "intent-reject-log.jsonl");
});

function baseEntry(overrides: Partial<IntentRejectEntry> = {}): IntentRejectEntry {
  return {
    intent_id: "int_proposed_abc",
    source_signal_ids: ["sig_1", "sig_2"],
    cluster_fingerprint: "abcdef0123456789",
    proposer_version: "v0.2-alpha-rule",
    rejected_at: "2026-04-22T05:12:00Z",
    reason: "thesis_disagree",
    note: "domain-specific counter",
    ...overrides,
  };
}

describe("IntentRejectEntrySchema", () => {
  it("accepts valid entry with all 8 reasons", () => {
    const reasons = [
      "weak_invalidation", "low_conviction", "duplicate_of_approved",
      "wrong_direction", "stale_signals", "out_of_scope",
      "thesis_disagree", "other",
    ] as const;
    for (const reason of reasons) {
      const entry = baseEntry({ reason, note: reason === "other" ? "must have note" : undefined });
      expect(IntentRejectEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it("requires note when reason='other'", () => {
    const bad = baseEntry({ reason: "other", note: undefined });
    expect(IntentRejectEntrySchema.safeParse(bad).success).toBe(false);

    const good = baseEntry({ reason: "other", note: "bank holiday" });
    expect(IntentRejectEntrySchema.safeParse(good).success).toBe(true);
  });

  it("rejects empty note when reason='other'", () => {
    const bad = baseEntry({ reason: "other", note: "" });
    expect(IntentRejectEntrySchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown reason", () => {
    const bad = { ...baseEntry(), reason: "invented_reason" };
    expect(IntentRejectEntrySchema.safeParse(bad).success).toBe(false);
  });
});

describe("appendRejectEntry + readRejectLog", () => {
  it("appends a single entry and reads it back", () => {
    appendRejectEntry(logPath, baseEntry());
    const entries = readRejectLog(logPath);
    expect(entries).toHaveLength(1);
    expect(entries[0].intent_id).toBe("int_proposed_abc");
  });

  it("appends multiple entries preserving order", () => {
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_1" }));
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_2" }));
    const entries = readRejectLog(logPath);
    expect(entries.map(e => e.intent_id)).toEqual(["int_1", "int_2"]);
  });

  it("returns empty array when file missing", () => {
    expect(readRejectLog(path.join(tmpDir, "nope.jsonl"))).toEqual([]);
  });

  it("filters by windowHours (drops older entries)", () => {
    const now = new Date();
    const old = new Date(now.getTime() - 100 * 3600 * 1000).toISOString(); // 100h ago
    const recent = new Date(now.getTime() - 10 * 3600 * 1000).toISOString(); // 10h ago
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_old", rejected_at: old }));
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_recent", rejected_at: recent }));
    const recentEntries = readRejectLog(logPath, 72);
    expect(recentEntries.map(e => e.intent_id)).toEqual(["int_recent"]);
  });

  it("skips lines that fail schema validation (forward-compat)", () => {
    fs.writeFileSync(logPath, '{"malformed": true}\n' + JSON.stringify(baseEntry()) + "\n");
    const entries = readRejectLog(logPath);
    expect(entries).toHaveLength(1);
  });
});
