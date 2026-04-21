import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { approveIntent } from "@/scripts/approve-intent";

let tmpDir: string;
let intentsPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ap-"));
  intentsPath = path.join(tmpDir, "tradeintents.jsonl");
});

function writeProposed(id: string, overrides: Record<string, any> = {}) {
  const row = {
    intent_id: id,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    schema_version: "0.1-alpha",
    created_at: "2026-04-21T23:03:00Z",
    updated_at: "2026-04-21T23:03:00Z",
    status: "proposed",
    expires_at: "2099-01-01T00:00:00Z",
    source_signal_ids: ["sig_1", "sig_2"],
    title: "test", description: "test description here",
    side: "accumulate", target_assets: ["ADA"],
    thesis: "test thesis long enough over twenty chars",
    why_now: "test why_now long enough over twenty chars",
    invalidation_thesis: "ADA が $0.221 を下抜ける、または 2026-05-19 までに 提案可決 が実現しない場合は仮説破棄",
    thesis_conviction: 0.7, execution_confidence: 0.4, priority: 0.5,
    preferred_horizon: "position", portfolio_context: { bucket: "core" },
    human_review: { required: true },
    display: {
      headline_en: "ADA governance momentum approved",
      headline_ja: "ADA ガバナンス活性化",
      summary_en: "Gov momentum twenty plus chars here.",
      summary_ja: "ガバナンス活性化の要点 twenty plus chars ja.",
    },
    authored_via: "sde_auto_proposal", visibility: "private",
    proposer_metadata: {
      version: "v0.2-alpha-rule",
      cluster_fingerprint: "fp123",
      generated_at: "2026-04-21T23:03:00Z",
    },
    ...overrides,
  };
  fs.appendFileSync(intentsPath, JSON.stringify(row) + "\n");
}

describe("approveIntent", () => {
  it("transitions proposed → approved with same intent_id", async () => {
    writeProposed("int_proposed_0000000000000001");
    const result = await approveIntent({
      intentsJsonlPath: intentsPath,
      intentId: "int_proposed_0000000000000001",
      nowIso: "2026-04-22T05:15:00Z",
    });
    expect(result.ok).toBe(true);
    const rows = fs.readFileSync(intentsPath, "utf-8").split("\n").filter(Boolean);
    expect(rows).toHaveLength(2);
    const latest = JSON.parse(rows[1]);
    expect(latest.intent_id).toBe("int_proposed_0000000000000001");
    expect(latest.status).toBe("approved");
    expect(latest.visibility).toBe("public");
    expect(latest.human_review.approved_by).toBe("LiveMakers Terminal");
    expect(latest.human_review.approved_at).toBe("2026-04-22T05:15:00Z");
  });

  it("rejects approve when placeholder present in invalidation_thesis", async () => {
    writeProposed("int_proposed_0000000000000002", {
      invalidation_thesis:
        "<<MANUAL: something>>、または 2026-05-19 までに y が実現しない場合は仮説破棄",
    });
    await expect(
      approveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_proposed_0000000000000002",
        nowIso: "2026-04-22T05:15:00Z",
      }),
    ).rejects.toThrow(/placeholder/i);
  });

  it("rejects approve when EN display is empty", async () => {
    writeProposed("int_proposed_0000000000000003", {
      display: {
        headline_en: "",
        headline_ja: "JA headline here",
        summary_en: "",
        summary_ja: "JA summary test with twenty plus chars here",
      },
    });
    await expect(
      approveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_proposed_0000000000000003",
        nowIso: "2026-04-22T05:15:00Z",
      }),
    ).rejects.toThrow(/bilingual|english|display_en|headline_en/i);
  });

  it("rejects approve when status is not proposed (e.g., cancelled)", async () => {
    writeProposed("int_proposed_0000000000000004", { status: "cancelled", visibility: "private" });
    await expect(
      approveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_proposed_0000000000000004",
        nowIso: "2026-04-22T05:15:00Z",
      }),
    ).rejects.toThrow(/not.*proposed|status/i);
  });

  it("rejects unknown intent_id", async () => {
    await expect(
      approveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_missing000000",
        nowIso: "2026-04-22T05:15:00Z",
      }),
    ).rejects.toThrow(/not found|unknown/i);
  });
});
