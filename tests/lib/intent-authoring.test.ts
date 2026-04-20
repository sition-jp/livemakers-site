// tests/lib/intent-authoring.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  evaluateInvalidation,
  generateIntentId,
  createIntent,
  type CreateIntentInput,
} from "@/lib/intent-authoring";

describe("lib/intent-authoring — evaluateInvalidation (3-tier heuristic)", () => {
  it("HR-1: empty string → hard_reject", () => {
    expect(evaluateInvalidation("")).toBe("hard_reject");
  });

  it("HR-2: under 20 chars → hard_reject", () => {
    expect(evaluateInvalidation("short sentence")).toBe("hard_reject");
  });

  it("HR-3: tautology 'if wrong I exit' → hard_reject", () => {
    expect(
      evaluateInvalidation("If wrong I exit the position immediately."),
    ).toBe("hard_reject");
  });

  it("HR-4: JA tautology 'もし間違えたら抜ける' → hard_reject", () => {
    expect(evaluateInvalidation("もし間違えたら抜けるつもりです。")).toBe(
      "hard_reject",
    );
  });

  it("SW-1: vague EN phrase → soft_warning", () => {
    expect(
      evaluateInvalidation(
        "If sentiment changes or conditions worsen I will exit the trade.",
      ),
    ).toBe("soft_warning");
  });

  it("SW-2: vague JA phrase → soft_warning", () => {
    expect(
      evaluateInvalidation(
        "状況が悪化したら撤退する予定の意図で書いています。",
      ),
    ).toBe("soft_warning");
  });

  it("P-1: price-level trigger → pass", () => {
    expect(
      evaluateInvalidation("Cancel if BTC weekly close drops below $55k."),
    ).toBe("pass");
  });

  it("P-2: JA with epoch identifier → pass", () => {
    expect(
      evaluateInvalidation(
        "epoch 625 時点で stake bonus が 50% を下回ったら撤退。",
      ),
    ).toBe("pass");
  });

  it("P-3: indicator threshold → pass", () => {
    expect(
      evaluateInvalidation("Exit if funding rate > 0.1% for three days."),
    ).toBe("pass");
  });
});

describe("lib/intent-authoring — generateIntentId", () => {
  it("ID-1: returns a string matching ^int_[a-z0-9]{16}$", () => {
    for (let i = 0; i < 20; i++) {
      const id = generateIntentId();
      expect(id).toMatch(/^int_[a-z0-9]{16}$/);
    }
  });

  it("ID-2: 100 generated ids are all unique", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateIntentId());
    expect(ids.size).toBe(100);
  });
});

describe("lib/intent-authoring — createIntent", () => {
  let tmpDir: string;
  let jsonlPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-intents-"));
    jsonlPath = path.join(tmpDir, "tradeintents.jsonl");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function validInput(): CreateIntentInput {
    return {
      source_signal_ids: ["sig_001"],
      title: "ADA accumulation — epoch 622",
      description: "Accumulate ADA during the epoch 622 bonus window.",
      side: "accumulate",
      target_assets: ["ADA"],
      thesis:
        "Cardano epoch 622 transition coincides with Treasury Fit endorsement.",
      why_now: "Bonus window opens for five days starting epoch 622.",
      invalidation_thesis: "Cancel if BTC weekly close drops below $55k.",
      thesis_conviction: 0.72,
      execution_confidence: 0.45,
      priority: 0.6,
      preferred_horizon: "swing",
      portfolio_context: { bucket: "tactical" },
      display: {
        headline_en: "ADA accumulation — Epoch 622",
        headline_ja: "ADA 段階買い — エポック 622",
        summary_en: "Stakers receive bonus for 5 days; size conservative.",
        summary_ja:
          "ステーキング報酬ボーナスが 5 日間開放。ポジションは保守的に。",
      },
    };
  }

  it("CI-1: appends a valid line and returns the created TradeIntent", async () => {
    const result = await createIntent(validInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_001"]),
    });
    expect(result.intent.intent_id).toMatch(/^int_[a-z0-9]{16}$/);
    expect(result.intent.status).toBe("approved");
    expect(result.intent.human_review.approved_by).toBe("LiveMakers Terminal");
    expect(result.intent.authored_via).toBe("claude_code_dialogue");
    expect(result.intent.visibility).toBe("public");
    const text = fs.readFileSync(jsonlPath, "utf-8");
    expect(text.trim().split("\n")).toHaveLength(1);
    expect(text).toContain(result.intent.intent_id);
  });

  it("CI-2: rejects when source_signal_ids references unknown signal", async () => {
    await expect(
      createIntent(
        { ...validInput(), source_signal_ids: ["sig_ghost"] },
        { jsonlPath, knownSignalIds: new Set(["sig_001"]) },
      ),
    ).rejects.toThrow(/unknown signal/i);
  });

  it("CI-3: rejects hard_reject invalidation (tautology)", async () => {
    await expect(
      createIntent(
        { ...validInput(), invalidation_thesis: "if wrong I exit." },
        { jsonlPath, knownSignalIds: new Set(["sig_001"]) },
      ),
    ).rejects.toThrow(/invalidation/i);
  });

  it("CI-4: soft_warning allowed with allowSoftOverride=true, logged to audit", async () => {
    const auditPath = path.join(tmpDir, "soft-override.log.jsonl");
    const result = await createIntent(
      {
        ...validInput(),
        invalidation_thesis:
          "If sentiment changes or conditions worsen the thesis weakens and I will stop buying more.",
      },
      {
        jsonlPath,
        knownSignalIds: new Set(["sig_001"]),
        allowSoftOverride: true,
        overrideAuditPath: auditPath,
      },
    );
    expect(result.warnings.invalidationTier).toBe("soft_warning");
    expect(fs.existsSync(auditPath)).toBe(true);
    const log = fs.readFileSync(auditPath, "utf-8").trim();
    expect(log).toContain(result.intent.intent_id);
  });

  it("CI-5: soft_warning rejected by default (allowSoftOverride=false)", async () => {
    await expect(
      createIntent(
        {
          ...validInput(),
          invalidation_thesis:
            "If sentiment changes or conditions worsen I will stop buying more.",
        },
        { jsonlPath, knownSignalIds: new Set(["sig_001"]) },
      ),
    ).rejects.toThrow(/soft_warning/);
  });

  it("CI-6: sets timestamps consistently (created_at=updated_at=approved_at)", async () => {
    const before = Date.now();
    const result = await createIntent(validInput(), {
      jsonlPath,
      knownSignalIds: new Set(["sig_001"]),
    });
    const after = Date.now();
    const created = Date.parse(result.intent.created_at);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
    expect(result.intent.updated_at).toBe(result.intent.created_at);
    expect(result.intent.human_review.approved_at).toBe(
      result.intent.created_at,
    );
  });

  it("CI-7: concurrent write detected when jsonl grew unexpectedly", async () => {
    const input = validInput();
    let firstCall = true;
    const result = await createIntent(input, {
      jsonlPath,
      knownSignalIds: new Set(["sig_001"]),
      beforeAppendHook: () => {
        if (firstCall) {
          firstCall = false;
          fs.writeFileSync(jsonlPath, "sneaky external row\n", { flag: "a" });
        }
      },
    });
    expect(result.warnings.concurrentWriteSuspected).toBe(true);
  });

  it("CI-8: target_protocols optional, priority defaults to 0.5 when input omits it", async () => {
    const input = validInput();
    delete (input as any).priority;
    const result = await createIntent(input, {
      jsonlPath,
      knownSignalIds: new Set(["sig_001"]),
    });
    expect(result.intent.priority).toBe(0.5);
    expect(result.intent.target_protocols).toBeUndefined();
  });

  it("CI-9: expires_at accepted and validated against created_at", async () => {
    const fut = new Date(Date.now() + 86_400_000).toISOString();
    const result = await createIntent(
      { ...validInput(), expires_at: fut },
      { jsonlPath, knownSignalIds: new Set(["sig_001"]) },
    );
    expect(result.intent.expires_at).toBe(fut);
  });

  it("CI-10: expires_at in the past is rejected", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    await expect(
      createIntent(
        { ...validInput(), expires_at: past },
        { jsonlPath, knownSignalIds: new Set(["sig_001"]) },
      ),
    ).rejects.toThrow(/expires_at/);
  });
});
