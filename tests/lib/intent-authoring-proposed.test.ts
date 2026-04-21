import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  createProposedIntent,
  type CreateProposedIntentInput,
} from "@/lib/intent-authoring";

let tmpDir: string;
let jsonlPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "proposer-"));
  jsonlPath = path.join(tmpDir, "tradeintents.jsonl");
});

function baseInput(overrides: Partial<CreateProposedIntentInput> = {}): CreateProposedIntentInput {
  return {
    source_signal_ids: ["sig_1", "sig_2"],
    title: "ADA 買い増し: ガバナンス活性化",
    description: "DRep 1010 突破で ADA に accumulate バイアス示唆。",
    side: "accumulate",
    target_assets: ["ADA"],
    thesis: "ガバナンス活性化で ADA に accumulate バイアス示唆。DRep 1010 突破、Intersect 予算審議進行中。",
    why_now: "2026-04-21 に governance_shift 発生。2 件の裏付け Signal が 72h 以内に集中。",
    invalidation_thesis:
      "ADA が $0.221 を下抜ける、または 2026-05-19 までに 提案可決 が実現しない場合は仮説破棄",
    thesis_conviction: 0.72,
    execution_confidence: 0.40,
    priority: 0.5,
    preferred_horizon: "position",
    portfolio_context: { bucket: "core" },
    expires_at: "2026-05-19T23:03:00Z",
    display: {
      headline_en: "",
      headline_ja: "ガバナンス活性化と DRep 委任増で ADA 底堅さ示唆",
      summary_en: "",
      summary_ja: "ガバナンス活性化で ADA に中期の accumulate バイアス。",
    },
    proposer_metadata: {
      version: "v0.2-alpha-rule",
      cluster_fingerprint: "abcdef0123456789",
      generated_at: "2026-04-21T14:03:00Z",
    },
    ...overrides,
  };
}

describe("createProposedIntent", () => {
  it("creates with status=proposed / visibility=private / authored_via=sde_auto_proposal", async () => {
    const knownSignalIds = new Set(["sig_1", "sig_2"]);
    const result = await createProposedIntent(baseInput(), {
      jsonlPath,
      knownSignalIds,
    });
    expect(result.intent.status).toBe("proposed");
    expect(result.intent.visibility).toBe("private");
    expect(result.intent.authored_via).toBe("sde_auto_proposal");
  });

  it("intent_id has int_proposed_ prefix with 16 hex", async () => {
    const result = await createProposedIntent(baseInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_1", "sig_2"]),
    });
    expect(result.intent.intent_id).toMatch(/^int_proposed_[0-9a-f]{16}$/);
  });

  it("accepts placeholder invalidation (relaxed heuristic)", async () => {
    const result = await createProposedIntent(
      baseInput({
        invalidation_thesis:
          "<<MANUAL: ADA の無効化条件>>、または 2026-05-19 までに 提案可決 が実現しない場合は仮説破棄",
      }),
      {
        jsonlPath,
        knownSignalIds: new Set(["sig_1", "sig_2"]),
      },
    );
    expect(result.intent.invalidation_thesis).toContain("<<MANUAL:");
    expect(result.warnings?.placeholderPresent).toBe(true);
  });

  it("accepts empty EN display (bilingual deferred to approve)", async () => {
    const result = await createProposedIntent(baseInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_1", "sig_2"]),
    });
    expect(result.intent.display.headline_en).toBe("");
    expect(result.intent.display.headline_ja).not.toBe("");
  });

  it("proposer_metadata persisted with all 3 fields", async () => {
    const result = await createProposedIntent(baseInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_1", "sig_2"]),
    });
    expect(result.intent.proposer_metadata).toEqual({
      version: "v0.2-alpha-rule",
      cluster_fingerprint: "abcdef0123456789",
      generated_at: "2026-04-21T14:03:00Z",
    });
  });

  it("rejects unknown source signal id", async () => {
    await expect(
      createProposedIntent(baseInput(), {
        jsonlPath,
        knownSignalIds: new Set(["sig_1"]),
      }),
    ).rejects.toThrow(/unknown signal/);
  });

  it("appends to jsonl file", async () => {
    await createProposedIntent(baseInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_1", "sig_2"]),
    });
    const content = fs.readFileSync(jsonlPath, "utf-8");
    expect(content.split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("human_review.approved_by/at are undefined (set at approve time)", async () => {
    const result = await createProposedIntent(baseInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_1", "sig_2"]),
    });
    expect(result.intent.human_review.required).toBe(true);
    expect(result.intent.human_review.approved_by).toBeUndefined();
    expect(result.intent.human_review.approved_at).toBeUndefined();
  });

  it("result.warnings is undefined when no placeholder present", async () => {
    const result = await createProposedIntent(baseInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_1", "sig_2"]),
    });
    expect(result.warnings).toBeUndefined();
  });
});
