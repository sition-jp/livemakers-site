import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { readActiveSignals } from "@/lib/proposer/signal-reader";

const FIXTURE = path.join(__dirname, "../../fixtures/proposer/signals.sample.jsonl");

describe("readActiveSignals", () => {
  it("returns empty array when file missing", () => {
    const result = readActiveSignals({
      signalsJsonlPath: "/tmp/no-such-file.jsonl",
      windowHours: 72,
      nowIso: "2026-04-21T23:00:00Z",
    });
    expect(result).toEqual([]);
  });

  it("filters by latest-row-wins per signal_id", () => {
    // sig_a has 2 rows: first active at 12:00, later invalidated at 15:00
    // latest-row-wins → should be EXCLUDED (invalidated)
    const result = readActiveSignals({
      signalsJsonlPath: FIXTURE,
      windowHours: 72,
      nowIso: "2026-04-21T23:00:00Z",
    });
    expect(result.map((s) => s.id)).not.toContain("sig_a");
  });

  it("filters status != active", () => {
    const result = readActiveSignals({
      signalsJsonlPath: FIXTURE,
      windowHours: 72,
      nowIso: "2026-04-21T23:00:00Z",
    });
    expect(result.map((s) => s.id)).not.toContain("sig_c"); // invalidated
  });

  it("filters outside window", () => {
    const result = readActiveSignals({
      signalsJsonlPath: FIXTURE,
      windowHours: 72,
      nowIso: "2026-04-21T23:00:00Z",
    });
    expect(result.map((s) => s.id)).not.toContain("sig_stale"); // 6 days old
  });

  it("returns active signals within window", () => {
    const result = readActiveSignals({
      signalsJsonlPath: FIXTURE,
      windowHours: 72,
      nowIso: "2026-04-21T23:00:00Z",
    });
    expect(result.map((s) => s.id).sort()).toEqual(["sig_b"]); // sig_a invalidated by later row
  });
});

describe("readActiveSignals — production null shape (regression guard)", () => {
  // Regression guard for the silent-drop bug fixed in follow-up to d12157c:
  // the from-scratch reader used SignalSchema.safeParse() directly on JSON
  // rows containing null in optional fields (Python Optional[T] serialization).
  // zod .optional() rejects null → 100% of production rows silently dropped.
  // Fix: delegate to readAndParseSignals() which coerces null → undefined at
  // the reader boundary before schema validation.
  it("parses production-style rows with JSON null in optional fields", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sig-prod-"));
    const p = path.join(tmpDir, "signals.jsonl");

    // Production shape: every Optional[T] field serialized as null.
    const prodRow = {
      id: "sig_prod_1",
      trace_id: "t",
      root_trace_id: "rt",
      schema_version: "1.1-beta",
      created_at: "2026-04-21T20:00:00Z",
      updated_at: null,
      type: "governance_shift",
      subtype: "drep",
      pillar: "governance_and_treasury",
      status: "active",
      expires_at: null,
      supersedes_signal_id: null,
      conflict_group: null,
      idempotency_key: "idem-1",
      event_key: null,
      confidence: 0.78,
      impact: "high",
      urgency: 0.6,
      time_horizon: "months",
      direction: "positive",
      position_hint: null,
      evidence: [],
      similar_cases: [],
      related_assets: ["ADA"],
      related_protocols: [],
      primary_asset: "ADA",
      tradable: true,
      sipo_action: null,
      headline_en: "prod",
      headline_ja: "prod",
      summary_en: "prod",
      summary_ja: "prod",
      source_ids: [],
      audit_note: null,
      locked_fields: null,
    };
    fs.writeFileSync(p, JSON.stringify(prodRow) + "\n");

    const result = readActiveSignals({
      signalsJsonlPath: p,
      windowHours: 72,
      nowIso: "2026-04-21T23:00:00Z",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sig_prod_1");
  });
});
