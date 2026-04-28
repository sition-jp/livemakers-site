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

  // F3 fix (2026-04-28): nowMs injection so callers using simulated/test time
  // (e.g. runProposer with nowIso) can window-filter consistently. Without
  // this, the dedupe-against-recent-reject test couples to wall-clock time.
  it("uses injected nowMs (not Date.now()) for window cutoff when provided", () => {
    // Pretend "now" is 2026-04-21T23:35:00Z. Window 72h.
    const simulatedNowMs = Date.parse("2026-04-21T23:35:00Z");
    const cutoffMs = simulatedNowMs - 72 * 3600 * 1000; // 2026-04-18 ~23:35
    const inWindow = new Date(simulatedNowMs - 5 * 60 * 1000).toISOString(); // 5min ago
    const outWindow = new Date(cutoffMs - 60 * 60 * 1000).toISOString(); // 1h before cutoff
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_inwin", rejected_at: inWindow }));
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_outwin", rejected_at: outWindow }));

    const recent = readRejectLog(logPath, 72, simulatedNowMs);
    expect(recent.map(e => e.intent_id)).toEqual(["int_inwin"]);
  });

  it("falls back to Date.now() when nowMs is undefined (preserves legacy behavior)", () => {
    const realNow = Date.now();
    const old = new Date(realNow - 100 * 3600 * 1000).toISOString();
    const recent = new Date(realNow - 5 * 60 * 1000).toISOString();
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_old", rejected_at: old }));
    appendRejectEntry(logPath, baseEntry({ intent_id: "int_recent", rejected_at: recent }));
    // No nowMs argument → uses real wall-clock
    const entries = readRejectLog(logPath, 72);
    expect(entries.map(e => e.intent_id)).toEqual(["int_recent"]);
  });
});
