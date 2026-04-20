// tests/lib/intents-reader.test.ts
import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import {
  resolveIntentsPath,
  readAndParseIntents,
  collapseLatestIntentById,
} from "@/lib/intents-reader";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/intents");

describe("lib/intents-reader — resolveIntentsPath", () => {
  const origEnv = process.env.LM_INTENTS_JSONL_PATH;
  afterEach(() => {
    if (origEnv === undefined) delete process.env.LM_INTENTS_JSONL_PATH;
    else process.env.LM_INTENTS_JSONL_PATH = origEnv;
  });

  it("IR-1a: returns LM_INTENTS_JSONL_PATH env var when set", () => {
    process.env.LM_INTENTS_JSONL_PATH = "/custom/path/tradeintents.jsonl";
    expect(resolveIntentsPath()).toBe("/custom/path/tradeintents.jsonl");
  });

  it("IR-1b: falls back to repo-local default when env var unset", () => {
    delete process.env.LM_INTENTS_JSONL_PATH;
    const p = resolveIntentsPath();
    expect(p).toContain("data/tradeintents.jsonl");
  });
});

describe("lib/intents-reader — readAndParseIntents", () => {
  it("IR-2: parses valid fixture with 2 distinct ids", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents, parseErrors, fileExists } = readAndParseIntents(p);
    expect(fileExists).toBe(true);
    expect(parseErrors).toEqual([]);
    expect(intents).toHaveLength(2);
    expect(intents.map((i) => i.intent_id).sort()).toEqual([
      "int_0000000000000001",
      "int_0000000000000002",
    ]);
  });

  it("IR-3: missing file returns empty + fileExists=false", () => {
    const p = path.join(FIXTURE_DIR, "does-not-exist.jsonl");
    const r = readAndParseIntents(p);
    expect(r.fileExists).toBe(false);
    expect(r.intents).toEqual([]);
    expect(r.mtimeMs).toBeNull();
  });

  it("IR-4: invalid JSON line: skipped + recorded in parseErrors", () => {
    const p = path.join(FIXTURE_DIR, "invalid-json.jsonl");
    const { intents, parseErrors } = readAndParseIntents(p);
    expect(intents).toHaveLength(1);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].lineNumber).toBe(2);
  });

  it("IR-5: schema-violation line: skipped + recorded in parseErrors", () => {
    const p = path.join(FIXTURE_DIR, "schema-violation.jsonl");
    const { intents, parseErrors } = readAndParseIntents(p);
    expect(intents).toHaveLength(1);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].lineNumber).toBe(2);
  });

  it("IR-6: returns mtimeMs for real file", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { mtimeMs } = readAndParseIntents(p);
    expect(mtimeMs).toBeGreaterThan(0);
  });
});

describe("lib/intents-reader — collapseLatestIntentById", () => {
  it("IR-7: collapses same-id entries to the latest updated_at", () => {
    const p = path.join(FIXTURE_DIR, "latest-wins.jsonl");
    const { intents } = readAndParseIntents(p);
    // raw read returns both rows
    expect(intents).toHaveLength(2);
    const collapsed = collapseLatestIntentById(intents);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].title).toBe("new");
    expect(collapsed[0].thesis_conviction).toBe(0.8);
  });

  it("IR-8: empty input returns empty output", () => {
    expect(collapseLatestIntentById([])).toEqual([]);
  });
});

describe("lib/intents-reader — collapseLatestIntentById tie-break", () => {
  it("IR-9: identical updated_at → last row in input wins (file-order tie-break)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "intents-tie-"));
    const p = path.join(tmp, "tie.jsonl");
    try {
      // Two rows, same intent_id, same updated_at, different title.
      const rowA = {
        intent_id: "int_0000000000000099",
        trace_id: "00000000-0000-4000-8000-000000000099",
        schema_version: "0.1-alpha",
        created_at: "2026-04-20T09:00:00Z",
        updated_at: "2026-04-20T09:00:00Z",
        status: "approved",
        source_signal_ids: ["sig_001"],
        title: "earlier-in-file",
        description: "desc",
        side: "accumulate",
        target_assets: ["ADA"],
        thesis: "Thesis long enough to pass validation.",
        why_now: "Why now reason sufficiently long.",
        invalidation_thesis: "Cancel if BTC weekly close < $55k.",
        thesis_conviction: 0.7,
        execution_confidence: 0.5,
        priority: 0.5,
        preferred_horizon: "swing",
        portfolio_context: { bucket: "tactical" },
        human_review: {
          required: true,
          approved_by: "LiveMakers Terminal",
          approved_at: "2026-04-20T09:00:00Z",
        },
        display: {
          headline_en: "E",
          headline_ja: "J",
          summary_en: "Summary long enough to pass validation.",
          summary_ja: "十分長い要約の日本語サンプル文字列です。これでバリデーション通過。",
        },
        visibility: "public",
        authored_via: "claude_code_dialogue",
      };
      const rowB = { ...rowA, title: "later-in-file" };
      fs.writeFileSync(
        p,
        JSON.stringify(rowA) + "\n" + JSON.stringify(rowB) + "\n",
      );
      const { intents } = readAndParseIntents(p);
      const collapsed = collapseLatestIntentById(intents);
      expect(collapsed).toHaveLength(1);
      expect(collapsed[0].title).toBe("later-in-file");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

import {
  buildIntentListResponse,
  buildIntentDetailResponse,
  buildReferencingIntentIds,
  flagInvariantBreaches,
  type IntentListResponse,
  type IntentDetailResponse,
} from "@/lib/intents-reader";
import type { Signal } from "@/lib/signals";

function signalStub(id: string, overrides: Partial<Signal> = {}): Signal {
  return {
    id,
    trace_id: "trace_" + id,
    root_trace_id: "trace_" + id,
    schema_version: "1.1-beta",
    created_at: "2026-04-18T10:00:00Z",
    updated_at: "2026-04-18T10:00:00Z",
    type: "governance_event",
    subtype: "drep_vote",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem_" + id,
    confidence: 0.8,
    impact: "high",
    urgency: 0.7,
    time_horizon: "1-2 weeks",
    direction: "positive",
    evidence: [],
    similar_cases: [],
    related_assets: ["ADA"],
    related_protocols: [],
    primary_asset: "ADA",
    tradable: false,
    headline_en: "hl en",
    headline_ja: "hl ja",
    summary_en: "sum en",
    summary_ja: "sum ja",
    source_ids: [],
    ...overrides,
  } as Signal;
}

describe("lib/intents-reader — buildIntentListResponse", () => {
  it("BL-1: filters to visibility=public and returns summaries + meta", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents, mtimeMs } = readAndParseIntents(p);
    const freshnessSec = 42;
    const res: IntentListResponse = buildIntentListResponse(
      intents,
      freshnessSec,
    );
    expect(res.intents).toHaveLength(2);
    expect(res.meta.count).toBe(2);
    expect(res.meta.source_freshness_sec).toBe(42);
    // visibility filter applied — both are public
    res.intents.forEach((i) => expect(i.source_signal_ids).toBeDefined());
  });

  it("BL-2: non-public visibility is filtered out", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents } = readAndParseIntents(p);
    const mixed = intents.map((i, idx) =>
      idx === 0 ? { ...i, visibility: "private" as const } : i,
    );
    const res = buildIntentListResponse(mixed, 0);
    expect(res.intents).toHaveLength(1);
    expect(res.intents[0].intent_id).toBe("int_0000000000000002");
  });

  it("BL-3: empty input returns zero count", () => {
    const res = buildIntentListResponse([], -1);
    expect(res.intents).toEqual([]);
    expect(res.meta.count).toBe(0);
    expect(res.meta.source_freshness_sec).toBe(-1);
  });
});

describe("lib/intents-reader — buildIntentDetailResponse", () => {
  it("BD-1: found id returns intent + resolved source_signals", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents } = readAndParseIntents(p);
    const signals = [signalStub("sig_001"), signalStub("sig_002")];
    const res: IntentDetailResponse = buildIntentDetailResponse(
      intents,
      signals,
      "int_0000000000000001",
      10,
    );
    expect(res.status).toBe("ok");
    expect(res.intent?.intent_id).toBe("int_0000000000000001");
    expect(res.source_signals).toHaveLength(1);
    expect(res.source_signals[0].id).toBe("sig_001");
    expect(res.source_signals_missing).toEqual([]);
    expect(res.meta.found).toBe(true);
    expect(res.meta.source_freshness_sec).toBe(10);
  });

  it("BD-2: missing id returns status=not_found, intent=null", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents } = readAndParseIntents(p);
    const res = buildIntentDetailResponse(intents, [], "int_ghost", 0);
    expect(res.status).toBe("not_found");
    expect(res.intent).toBeNull();
    expect(res.source_signals).toEqual([]);
    expect(res.meta.found).toBe(false);
  });

  it("BD-3: source_signal_ids referencing non-existent signal goes to source_signals_missing", () => {
    const p = path.join(FIXTURE_DIR, "with-missing-signals.jsonl");
    const { intents } = readAndParseIntents(p);
    const res = buildIntentDetailResponse(
      intents,
      [],
      "int_0000000000000003",
      0,
    );
    expect(res.status).toBe("ok");
    expect(res.source_signals).toEqual([]);
    expect(res.source_signals_missing).toEqual(["sig_ghost"]);
  });

  it("BD-4: private intent not found by id even when passed unfiltered (SSOT self-protects)", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents } = readAndParseIntents(p);
    // Flip one row to private, pass unfiltered
    const mixed = intents.map((i, idx) =>
      idx === 0 ? { ...i, visibility: "private" as const } : i,
    );
    const res = buildIntentDetailResponse(
      mixed,
      [],
      "int_0000000000000001",
      0,
    );
    expect(res.status).toBe("not_found");
    expect(res.intent).toBeNull();
  });
});

describe("lib/intents-reader — inverted index for signal backlinks", () => {
  it("II-1: buildReferencingIntentIds returns empty for signal with no Intent", () => {
expect(buildReferencingIntentIds([], "sig_001")).toEqual([]);
  });

  it("II-2: buildReferencingIntentIds returns all Intent ids referencing that signal", () => {
const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents } = readAndParseIntents(p);
    expect(buildReferencingIntentIds(intents, "sig_001")).toEqual([
      "int_0000000000000001",
    ]);
    expect(buildReferencingIntentIds(intents, "sig_002")).toEqual([
      "int_0000000000000002",
    ]);
    expect(buildReferencingIntentIds(intents, "sig_ghost")).toEqual([]);
  });
});

describe("lib/intents-reader — invariants", () => {
  it("IV-1: flagInvariantBreaches returns breach list for updated_at < created_at", () => {
const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents } = readAndParseIntents(p);
    const bad = [
      { ...intents[0], updated_at: "2026-04-19T00:00:00Z" },
    ];
    const breaches = flagInvariantBreaches(bad);
    expect(breaches.length).toBeGreaterThan(0);
    expect(breaches[0]).toMatchObject({
      intent_id: "int_0000000000000001",
      rule: "updated_at>=created_at",
    });
  });

  it("IV-2: expires_at <= created_at flagged", () => {
const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents } = readAndParseIntents(p);
    const bad = [
      { ...intents[0], expires_at: "2026-04-19T00:00:00Z" },
    ];
    const breaches = flagInvariantBreaches(bad);
    expect(breaches.some((b: any) => b.rule === "expires_at>created_at")).toBe(
      true,
    );
  });
});
