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

// -----------------------------------------------------------------------------
// Task 1-3 — Signal detail page additions (spec §5.2)
// -----------------------------------------------------------------------------

import type {
  ChainResult,
  ChainStatus,
  SignalDetailResponse,
} from "@/lib/signals-reader";

describe("Task 1-3 types (spec §5.2)", () => {
  it("ChainStatus is a string union including 'not_found'", () => {
    const ok: ChainStatus = "ok";
    const mrt: ChainStatus = "missing_root_trace";
    const sf: ChainStatus = "singleton_fallback";
    const nf: ChainStatus = "not_found";
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    [ok, mrt, sf, nf];
    expect([ok, mrt, sf, nf]).toHaveLength(4);
  });

  it("ChainResult has chain / status / warnings", () => {
    const r: ChainResult = { chain: [], status: "singleton_fallback", warnings: [] };
    expect(r.status).toBe("singleton_fallback");
  });

  it("SignalDetailResponse has signal / chain / chain_status / chain_integrity_warnings / referencing_intent_ids / meta", () => {
    const r: SignalDetailResponse = {
      signal: null,
      chain: [],
      chain_status: "not_found",
      chain_integrity_warnings: [],
      referencing_intent_ids: [],
      meta: {
        found: false,
        chain_length: 0,
        root_trace_id: null,
        source_freshness_sec: 0,
      },
    };
    expect(r.meta.found).toBe(false);
  });
});

import { getSignalById } from "@/lib/signals-reader";
import type { Signal } from "@/lib/signals";

function makeSignal(overrides: Partial<Signal>): Signal {
  return {
    id: "sig_test",
    event_key: "evt_test",
    status: "active",
    confidence: 0.75,
    pillar: "governance",
    direction: "positive",
    created_at: "2026-04-19T10:00:00+00:00",
    // minimum required fields per SignalSchema; spread overrides wins
    ...overrides,
  } as Signal;
}

describe("getSignalById (spec §5.2)", () => {
  it("returns the signal when id matches", () => {
    const signals = [
      makeSignal({ id: "sig_a" }),
      makeSignal({ id: "sig_b" }),
    ];
    expect(getSignalById(signals, "sig_b")?.id).toBe("sig_b");
  });

  it("returns null when id is not in the list", () => {
    const signals = [makeSignal({ id: "sig_a" })];
    expect(getSignalById(signals, "sig_missing")).toBeNull();
  });
});

import { buildSupersedeChain } from "@/lib/signals-reader";

describe("buildSupersedeChain (spec §5.2)", () => {
  it("returns missing_root_trace when root_trace_id is null", () => {
    const current = makeSignal({ id: "sig_legacy", root_trace_id: null as any });
    const result = buildSupersedeChain([current], current);
    expect(result.status).toBe("missing_root_trace");
    expect(result.chain).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("returns singleton_fallback when only the signal itself matches its root_trace_id", () => {
    const current = makeSignal({ id: "sig_new", root_trace_id: "root_1" });
    const result = buildSupersedeChain([current], current);
    expect(result.status).toBe("singleton_fallback");
    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].id).toBe("sig_new");
    expect(result.warnings).toEqual([]);
  });

  it("returns ok with asc-by-updated_at chain when multiple rows share root_trace_id", () => {
    const s1 = makeSignal({
      id: "sig_001",
      root_trace_id: "root_x",
      updated_at: "2026-04-18T23:05:00+00:00",
      supersedes_signal_id: undefined,
    });
    const s2 = makeSignal({
      id: "sig_002",
      root_trace_id: "root_x",
      updated_at: "2026-04-19T02:15:00+00:00",
      supersedes_signal_id: "sig_001",
    });
    const s3 = makeSignal({
      id: "sig_003",
      root_trace_id: "root_x",
      updated_at: "2026-04-19T09:07:00+00:00",
      supersedes_signal_id: "sig_002",
    });
    // Provide in non-sorted order to verify sort happens inside
    const result = buildSupersedeChain([s3, s1, s2], s3);
    expect(result.status).toBe("ok");
    expect(result.chain.map((s) => s.id)).toEqual(["sig_001", "sig_002", "sig_003"]);
    expect(result.warnings).toEqual([]); // clean adjacency
  });
});

import { verifyChainIntegrity } from "@/lib/signals-reader";

describe("verifyChainIntegrity (spec §5.2 v0.3 Finding 2)", () => {
  it("returns empty array for a clean chain (adjacent supersedes_signal_id links)", () => {
    const chain = [
      makeSignal({ id: "a", supersedes_signal_id: undefined }),
      makeSignal({ id: "b", supersedes_signal_id: "a" }),
      makeSignal({ id: "c", supersedes_signal_id: "b" }),
    ];
    expect(verifyChainIntegrity(chain)).toEqual([]);
  });

  it("flags lineage break when row supersedes a non-adjacent prior id", () => {
    // c skips b: supersedes_signal_id="a" but prior row is "b"
    const chain = [
      makeSignal({ id: "a", supersedes_signal_id: undefined }),
      makeSignal({ id: "b", supersedes_signal_id: "a" }),
      makeSignal({ id: "c", supersedes_signal_id: "a" }),
    ];
    const warnings = verifyChainIntegrity(chain);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/lineage break at c/);
    expect(warnings[0]).toMatch(/supersedes_signal_id=a/);
    // Pin spec §4.3 form: no trailing period after the id
    expect(warnings[0]).toMatch(/prior row in chain \(asc\) is b$/);
  });

  it("flags oldest row with unexpected supersedes_signal_id", () => {
    const chain = [
      makeSignal({ id: "a", supersedes_signal_id: "x" }), // should be null as oldest
    ];
    const warnings = verifyChainIntegrity(chain);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/oldest row a has unexpected supersedes_signal_id=x/);
  });

  it("flags non-oldest row whose supersedes_signal_id is null", () => {
    const chain = [
      makeSignal({ id: "a", supersedes_signal_id: undefined }),
      makeSignal({ id: "b", supersedes_signal_id: undefined }), // should be "a"
    ];
    const warnings = verifyChainIntegrity(chain);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/lineage break at b/);
    expect(warnings[0]).toMatch(/supersedes_signal_id=null/);
  });
});

import { buildSignalDetailResponse } from "@/lib/signals-reader";

describe("buildSignalDetailResponse (spec §5.2 v0.3 Finding 3 — SSOT)", () => {
  it("returns chain_status='not_found' when id not in signals", () => {
    const response = buildSignalDetailResponse([], [], "sig_missing", 42);
    expect(response.signal).toBeNull();
    expect(response.chain).toEqual([]);
    expect(response.chain_status).toBe("not_found");
    expect(response.chain_integrity_warnings).toEqual([]);
    expect(response.referencing_intent_ids).toEqual([]);
    expect(response.meta).toEqual({
      found: false,
      chain_length: 0,
      root_trace_id: null,
      source_freshness_sec: 42,
    });
  });

  it("returns chain_status='missing_root_trace' for legacy signal (root_trace_id null)", () => {
    const legacy = makeSignal({ id: "sig_old", root_trace_id: null as any });
    const response = buildSignalDetailResponse([legacy], [], "sig_old", 0);
    expect(response.signal?.id).toBe("sig_old");
    expect(response.chain_status).toBe("missing_root_trace");
    expect(response.chain).toEqual([]);
    expect(response.meta.found).toBe(true);
    expect(response.meta.root_trace_id).toBeNull();
  });

  it("returns chain_status='ok' with asc chain for healthy supersede chain", () => {
    const s1 = makeSignal({
      id: "a",
      root_trace_id: "r1",
      updated_at: "2026-04-19T10:00:00+00:00",
      supersedes_signal_id: undefined,
    });
    const s2 = makeSignal({
      id: "b",
      root_trace_id: "r1",
      updated_at: "2026-04-19T11:00:00+00:00",
      supersedes_signal_id: "a",
    });
    const response = buildSignalDetailResponse([s1, s2], [], "b", 0);
    expect(response.chain_status).toBe("ok");
    expect(response.chain.map((s) => s.id)).toEqual(["a", "b"]);
    expect(response.chain_integrity_warnings).toEqual([]);
    expect(response.meta.chain_length).toBe(2);
    expect(response.meta.root_trace_id).toBe("r1");
  });

  it("emits chain_integrity_warnings when adjacency breaks", () => {
    const s1 = makeSignal({
      id: "a",
      root_trace_id: "r1",
      updated_at: "2026-04-19T10:00:00+00:00",
      supersedes_signal_id: undefined,
    });
    const s2 = makeSignal({
      id: "b",
      root_trace_id: "r1",
      updated_at: "2026-04-19T11:00:00+00:00",
      supersedes_signal_id: "a",
    });
    const s3 = makeSignal({
      id: "c",
      root_trace_id: "r1",
      updated_at: "2026-04-19T12:00:00+00:00",
      supersedes_signal_id: "a", // should be "b"
    });
    const response = buildSignalDetailResponse([s1, s2, s3], [], "c", 0);
    expect(response.chain_status).toBe("ok");
    expect(response.chain_integrity_warnings).toHaveLength(1);
    expect(response.chain_integrity_warnings[0]).toMatch(/lineage break at c/);
  });

  it("preserves freshness parameter into meta", () => {
    const response = buildSignalDetailResponse([], [], "missing", 1234);
    expect(response.meta.source_freshness_sec).toBe(1234);
  });
});

import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";

describe("i18n: signals.detail.* namespace (spec §6.1)", () => {
  const requiredKeys = [
    "back_to_signals",
    "loading",
    "status_banner.superseded",
    "status_banner.superseded_with_latest",
    "status_banner.invalidated",
    "status_banner.expired",
    "status_banner.view_latest",
    "chain_integrity_notice.title",
    "chain_integrity_notice.intro",
    "chain_integrity_notice.warning_prefix",
    "field_grid.toggle_open",
    "field_grid.toggle_close",
    "field_grid.sections.identity",
    "field_grid.sections.status_timing",
    "field_grid.sections.classification",
    "field_grid.sections.assets_topics",
    "field_grid.sections.translation_state",
    "field_grid.sections.audit_lock",
    "field_grid.sections.evidence_full",
    "sections.assessment",
    "sections.evidence",
    "sections.related",
    "sections.chain",
    "sections.meta",
    "chain.no_chain",
    "chain.current_marker",
    "chain.headers.time",
    "chain.headers.status",
    "chain.headers.confidence",
    "chain.headers.id",
    "not_found.title",
    "not_found.message",
    "meta.id",
    "meta.event_key",
    "meta.root_trace_id",
    "meta.created_at",
    "meta.updated_at",
    "meta.translation_status",
  ];

  function getNested(obj: Record<string, unknown>, key: string): unknown {
    return key.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj);
  }

  for (const key of requiredKeys) {
    it(`en: signals.detail.${key} exists and is a string`, () => {
      const val = getNested(enMessages.signals.detail, key);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    });
    it(`ja: signals.detail.${key} exists and is a string`, () => {
      const val = getNested(jaMessages.signals.detail, key);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    });
  }
});
