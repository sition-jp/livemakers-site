import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  ProposerRunEntrySchema,
  ProposerRunStatusSchema,
  readLastRunLog,
  appendRunLogEntry,
  type ProposerRunEntry,
} from "@/lib/proposer/run-log";

let tmpDir: string;
let logPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-log-"));
  logPath = path.join(tmpDir, "proposer-run-log.jsonl");
});

function baseEntry(overrides: Partial<ProposerRunEntry> = {}): ProposerRunEntry {
  return {
    run_id: "r-550e8400-e29b-41d4-a716-446655440000",
    run_at: "2026-04-21T14:03:00Z",
    proposer_version: "v0.2-alpha-rule",
    status: "ok",
    clusters_detected: 5,
    clusters_after_dedupe: 3,
    proposals_created: 3,
    mixed_skipped: 1,
    ...overrides,
  };
}

describe("ProposerRunEntrySchema", () => {
  it("accepts status=ok with counts only", () => {
    expect(ProposerRunEntrySchema.safeParse(baseEntry()).success).toBe(true);
  });
  it("rejects status=ok with error field", () => {
    const bad = baseEntry({ error: "should not be present" });
    expect(ProposerRunEntrySchema.safeParse(bad).success).toBe(false);
  });
  it("rejects status=ok with warnings field", () => {
    const bad = baseEntry({ warnings: ["should not be present"] });
    expect(ProposerRunEntrySchema.safeParse(bad).success).toBe(false);
  });
  it("requires error field when status=error", () => {
    const bad = baseEntry({ status: "error" });
    expect(ProposerRunEntrySchema.safeParse(bad).success).toBe(false);
    const good = baseEntry({ status: "error", error: "market_indicators.jsonl missing" });
    expect(ProposerRunEntrySchema.safeParse(good).success).toBe(true);
  });
  it("requires non-empty warnings when status=warn", () => {
    const bad = baseEntry({ status: "warn" });
    expect(ProposerRunEntrySchema.safeParse(bad).success).toBe(false);
    const empty = baseEntry({ status: "warn", warnings: [] });
    expect(ProposerRunEntrySchema.safeParse(empty).success).toBe(false);
    const good = baseEntry({ status: "warn", warnings: ["NIGHT price missing"] });
    expect(ProposerRunEntrySchema.safeParse(good).success).toBe(true);
  });
  it("requires non-empty error string", () => {
    const bad = baseEntry({ status: "error", error: "" });
    expect(ProposerRunEntrySchema.safeParse(bad).success).toBe(false);
  });
});

describe("readLastRunLog + appendRunLogEntry", () => {
  it("returns null when file missing", () => {
    expect(readLastRunLog(path.join(tmpDir, "none.jsonl"))).toBeNull();
  });
  it("append then read returns last entry", () => {
    appendRunLogEntry(logPath, baseEntry({ run_id: "r1" }));
    appendRunLogEntry(logPath, baseEntry({ run_id: "r2" }));
    const last = readLastRunLog(logPath);
    expect(last?.run_id).toBe("r2");
  });
  it("skips malformed trailing line", () => {
    appendRunLogEntry(logPath, baseEntry({ run_id: "r1" }));
    fs.appendFileSync(logPath, "not json\n");
    const last = readLastRunLog(logPath);
    expect(last?.run_id).toBe("r1");
  });
});
