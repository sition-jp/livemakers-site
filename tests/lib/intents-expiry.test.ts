import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  IntentExpiryEntrySchema,
  ExpiryReasonSchema,
  readExpiryLog,
  appendExpiryEntry,
  type IntentExpiryEntry,
} from "@/lib/intents-expiry";

let tmpDir: string;
let logPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "expiry-log-"));
  logPath = path.join(tmpDir, "intent-expiry-log.jsonl");
});

function baseEntry(overrides: Partial<IntentExpiryEntry> = {}): IntentExpiryEntry {
  return {
    intent_id: "int_proposed_abc",
    source_signal_ids: ["sig_1", "sig_2"],
    cluster_fingerprint: "abcdef0123456789",
    proposer_version: "v0.2-alpha-rule",
    expired_at: "2026-04-22T23:03:00Z",
    reason: "timed_out_without_review",
    skip_count: 0,
    created_at: "2026-04-21T23:03:00Z",
    ...overrides,
  };
}

describe("IntentExpiryEntrySchema", () => {
  it("accepts both expiry reasons", () => {
    for (const reason of ["timed_out_without_review", "skip_then_timeout"] as const) {
      expect(IntentExpiryEntrySchema.safeParse(baseEntry({ reason })).success).toBe(true);
    }
  });

  it("accepts optional last_seen_at_review_gate", () => {
    const entry = baseEntry({
      reason: "skip_then_timeout",
      skip_count: 1,
      last_seen_at_review_gate: "2026-04-22T05:15:00Z",
    });
    expect(IntentExpiryEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("rejects negative skip_count", () => {
    expect(IntentExpiryEntrySchema.safeParse(baseEntry({ skip_count: -1 })).success).toBe(false);
  });

  it("rejects unknown reason", () => {
    expect(IntentExpiryEntrySchema.safeParse({ ...baseEntry(), reason: "foo" }).success).toBe(false);
  });
});

describe("appendExpiryEntry + readExpiryLog", () => {
  it("append + read roundtrip", () => {
    appendExpiryEntry(logPath, baseEntry());
    const entries = readExpiryLog(logPath);
    expect(entries).toHaveLength(1);
    expect(entries[0].reason).toBe("timed_out_without_review");
  });

  it("returns empty array when file missing", () => {
    expect(readExpiryLog(path.join(tmpDir, "missing.jsonl"))).toEqual([]);
  });

  it("skips malformed lines", () => {
    fs.writeFileSync(logPath, "not json\n" + JSON.stringify(baseEntry()) + "\n");
    expect(readExpiryLog(logPath)).toHaveLength(1);
  });
});
