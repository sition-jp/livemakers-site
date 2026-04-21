import { describe, it, expect } from "vitest";
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
