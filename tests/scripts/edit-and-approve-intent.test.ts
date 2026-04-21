import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { editAndApproveIntent } from "@/scripts/edit-and-approve-intent";

let tmpDir: string;
let intentsPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ea-"));
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
    source_signal_ids: ["sig_1"],
    title: "orig title", description: "orig description here",
    side: "accumulate", target_assets: ["ADA"],
    thesis: "orig thesis long enough over twenty chars",
    why_now: "orig why_now long enough over twenty chars",
    invalidation_thesis: "ADA が $0.221 を下抜ける、または 2026-05-19 までに 提案可決 が実現しない場合は仮説破棄",
    thesis_conviction: 0.7, execution_confidence: 0.4, priority: 0.5,
    preferred_horizon: "position", portfolio_context: { bucket: "core" },
    human_review: { required: true },
    display: {
      headline_en: "orig EN headline",
      headline_ja: "orig JA headline",
      summary_en: "orig EN summary twenty plus chars here",
      summary_ja: "orig JA summary twenty plus chars here",
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

describe("editAndApproveIntent", () => {
  it("applies patch and approves (same intent_id)", async () => {
    writeProposed("int_proposed_0000000000000010");
    const result = await editAndApproveIntent({
      intentsJsonlPath: intentsPath,
      intentId: "int_proposed_0000000000000010",
      patch: {
        invalidation_thesis:
          "ADA が $0.24 を下抜ける、または 2026-05-19 までに 提案可決 + 1.1bn ADA が実現しない場合は仮説破棄",
        execution_confidence: 0.55,
      },
      nowIso: "2026-04-22T05:20:00Z",
    });
    expect(result.intent.status).toBe("approved");
    expect(result.intent.invalidation_thesis).toContain("$0.24");
    expect(result.intent.execution_confidence).toBe(0.55);
    expect(result.intent.intent_id).toBe("int_proposed_0000000000000010");
  });

  it("rejects patch that leaves placeholder in invalidation_thesis", async () => {
    writeProposed("int_proposed_0000000000000011");
    await expect(
      editAndApproveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_proposed_0000000000000011",
        patch: {
          invalidation_thesis:
            "<<MANUAL: x>>、または 2026-05-19 までに y が実現しない場合は仮説破棄",
        },
        nowIso: "2026-04-22T05:20:00Z",
      }),
    ).rejects.toThrow(/placeholder/i);
  });

  it("rejects patch that breaks schema constraints", async () => {
    writeProposed("int_proposed_0000000000000012");
    await expect(
      editAndApproveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_proposed_0000000000000012",
        patch: { thesis_conviction: 1.5 }, // out of [0, 1]
        nowIso: "2026-04-22T05:20:00Z",
      }),
    ).rejects.toThrow();
  });

  it("fails when intent_id not found", async () => {
    await expect(
      editAndApproveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_missing000000",
        patch: {},
        nowIso: "2026-04-22T05:20:00Z",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("fails when intent not in proposed status", async () => {
    writeProposed("int_proposed_0000000000000013", { status: "approved", visibility: "public",
      human_review: { required: true, approved_by: "LiveMakers Terminal", approved_at: "2026-04-21T23:05:00Z" },
    });
    await expect(
      editAndApproveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_proposed_0000000000000013",
        patch: {},
        nowIso: "2026-04-22T05:20:00Z",
      }),
    ).rejects.toThrow(/not.*proposed|status/i);
  });

  it("rejects patch missing EN display (bilingual guard)", async () => {
    writeProposed("int_proposed_0000000000000014", {
      display: {
        headline_en: "",
        headline_ja: "JA",
        summary_en: "",
        summary_ja: "JA summary twenty plus chars here",
      },
    });
    await expect(
      editAndApproveIntent({
        intentsJsonlPath: intentsPath,
        intentId: "int_proposed_0000000000000014",
        patch: {}, // no display patch
        nowIso: "2026-04-22T05:20:00Z",
      }),
    ).rejects.toThrow(/bilingual|english|display/i);
  });

  it("patch providing EN display satisfies bilingual guard", async () => {
    writeProposed("int_proposed_0000000000000015", {
      display: {
        headline_en: "",
        headline_ja: "JA",
        summary_en: "",
        summary_ja: "JA summary twenty plus chars here",
      },
    });
    const result = await editAndApproveIntent({
      intentsJsonlPath: intentsPath,
      intentId: "int_proposed_0000000000000015",
      patch: {
        display: {
          headline_en: "EN headline manually provided",
          headline_ja: "JA",
          summary_en: "EN summary twenty plus chars here",
          summary_ja: "JA summary twenty plus chars here",
        },
      },
      nowIso: "2026-04-22T05:20:00Z",
    });
    expect(result.intent.status).toBe("approved");
    expect(result.intent.display.headline_en).toBe("EN headline manually provided");
  });

  it("preserves immutable fields: intent_id / created_at / authored_via / proposer_metadata", async () => {
    writeProposed("int_proposed_0000000000000016");
    const result = await editAndApproveIntent({
      intentsJsonlPath: intentsPath,
      intentId: "int_proposed_0000000000000016",
      patch: {
        intent_id: "int_hacked_000000" as any, // should NOT be applied
        created_at: "2099-01-01T00:00:00Z" as any,
        authored_via: "claude_code_dialogue" as any,
        proposer_metadata: { version: "hacked", cluster_fingerprint: "hacked", generated_at: "2099-01-01T00:00:00Z" } as any,
      },
      nowIso: "2026-04-22T05:20:00Z",
    });
    expect(result.intent.intent_id).toBe("int_proposed_0000000000000016");
    expect(result.intent.created_at).toBe("2026-04-21T23:03:00Z");
    expect(result.intent.authored_via).toBe("sde_auto_proposal");
    expect(result.intent.proposer_metadata?.version).toBe("v0.2-alpha-rule");
  });
});
