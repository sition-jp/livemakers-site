import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import {
  resolveSignalsPath,
  readAndParseSignals,
  collapseLatestById,
} from "@/lib/signals-reader";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/signals");

describe("lib/signals-reader — resolveSignalsPath", () => {
  const origEnv = process.env.LM_SIGNALS_JSONL_PATH;
  afterEach(() => {
    if (origEnv === undefined) delete process.env.LM_SIGNALS_JSONL_PATH;
    else process.env.LM_SIGNALS_JSONL_PATH = origEnv;
  });

  it("P-5a: returns LM_SIGNALS_JSONL_PATH env var when set", () => {
    process.env.LM_SIGNALS_JSONL_PATH = "/custom/path/signals.jsonl";
    expect(resolveSignalsPath()).toBe("/custom/path/signals.jsonl");
  });

  it("P-5b: falls back to monorepo-relative path when env var unset", () => {
    delete process.env.LM_SIGNALS_JSONL_PATH;
    const p = resolveSignalsPath();
    // cwd-relative default lives two levels up at 07_DATA/...
    expect(p).toContain("07_DATA/content/intelligence/signals.jsonl");
  });
});

describe("lib/signals-reader — readAndParseSignals", () => {
  it("P-1: parses valid fixture and returns all active signals (after collapse)", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { signals, parseErrors } = readAndParseSignals(p);
    // valid fixture has 8 lines, all distinct ids, all valid
    expect(signals.length).toBe(8);
    expect(parseErrors).toEqual([]);
    // Check one known signal
    const s1 = signals.find((s) => s.id === "sig_001");
    expect(s1?.confidence).toBe(0.85);
    expect(s1?.status).toBe("active");
  });

  it("P-2: latest-row-wins collapse (superseded after active)", () => {
    const p = path.join(FIXTURE_DIR, "supersede.jsonl");
    const { signals } = readAndParseSignals(p);
    // 3 lines: sig_X active, sig_X superseded, sig_Y active
    // After collapse: sig_X=superseded, sig_Y=active → 2 unique ids
    const ids = signals.map((s) => s.id).sort();
    expect(ids).toEqual(["sig_X", "sig_Y"]);
    const sigX = signals.find((s) => s.id === "sig_X");
    expect(sigX?.status).toBe("superseded");
    const sigY = signals.find((s) => s.id === "sig_Y");
    expect(sigY?.status).toBe("active");
    expect(sigY?.supersedes_signal_id).toBe("sig_X");
  });

  it("P-3: strict zod — parse failures are skipped, successful rows still returned, errors logged", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = path.join(FIXTURE_DIR, "mixed.jsonl");
    const { signals, parseErrors } = readAndParseSignals(p);
    // mixed.jsonl: 1 valid, 1 broken JSON, 1 legacy (event_key=null but otherwise valid)
    // legacy row is still a valid Signal per schema (event_key is optional)
    // but should be excluded from default active listing per spec P-4
    // At parse layer: 2 valid rows, 1 error
    expect(parseErrors.length).toBeGreaterThanOrEqual(1);
    expect(signals.find((s) => s.id === "sig_ok")).toBeDefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("P-4: legacy row (event_key=null) is still parseable but flagged as legacy", () => {
    const p = path.join(FIXTURE_DIR, "mixed.jsonl");
    const { signals } = readAndParseSignals(p);
    const legacy = signals.find((s) => s.id === "sig_legacy");
    // legacy must be parseable (event_key is optional in schema)
    expect(legacy).toBeDefined();
    expect(legacy?.event_key == null).toBe(true);
  });

  it("P-6: returns empty + null-mtime indicator when file does not exist", () => {
    const p = path.join(FIXTURE_DIR, "__nonexistent__.jsonl");
    const { signals, fileExists, mtimeMs } = readAndParseSignals(p);
    expect(signals).toEqual([]);
    expect(fileExists).toBe(false);
    expect(mtimeMs).toBeNull();
  });

  it("P-7: empty file returns empty signals array, fileExists=true", () => {
    const p = path.join(FIXTURE_DIR, "empty.jsonl");
    const { signals, fileExists } = readAndParseSignals(p);
    expect(signals).toEqual([]);
    expect(fileExists).toBe(true);
  });

  it("P-8: all-corrupted file returns empty signals + parseErrors populated", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = path.join(FIXTURE_DIR, "all_corrupted.jsonl");
    const { signals, parseErrors } = readAndParseSignals(p);
    expect(signals).toEqual([]);
    expect(parseErrors.length).toBeGreaterThan(0);
    errSpy.mockRestore();
  });

  it("P-9: real signals.jsonl (production-shaped with nulls) parses without errors", () => {
    // Sanity check: the production signals.jsonl (null-filled optional fields)
    // must round-trip through our reader without parse errors. This is the
    // load-bearing contract with SDE signal_generator.py.
    const monorepoRoot = path.resolve(__dirname, "../../../..");
    const p = path.join(
      monorepoRoot,
      "07_DATA/content/intelligence/signals.jsonl"
    );
    const fs = require("fs");
    if (!fs.existsSync(p)) {
      // Skip silently if production data absent (CI, fresh clone)
      return;
    }
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { signals, parseErrors } = readAndParseSignals(p);
    // Production file should parse cleanly
    expect(signals.length).toBeGreaterThan(0);
    expect(parseErrors).toEqual([]);
    errSpy.mockRestore();
  });

  it("P-10: mtimeMs is populated when file exists", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { mtimeMs, fileExists } = readAndParseSignals(p);
    expect(fileExists).toBe(true);
    expect(typeof mtimeMs).toBe("number");
    expect(mtimeMs).toBeGreaterThan(0);
  });
});

describe("lib/signals-reader — collapseLatestById", () => {
  it("collapses duplicate ids, keeping last occurrence (latest row wins)", () => {
    const s1 = { id: "a", status: "active" } as any;
    const s2 = { id: "a", status: "superseded" } as any;
    const s3 = { id: "b", status: "active" } as any;
    const out = collapseLatestById([s1, s2, s3]);
    expect(out.length).toBe(2);
    const a = out.find((s) => s.id === "a");
    expect(a?.status).toBe("superseded");
  });
});
