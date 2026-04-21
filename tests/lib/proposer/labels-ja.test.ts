import { describe, it, expect } from "vitest";
import {
  SIDE_JA,
  HORIZON_JA,
  BUCKET_JA,
  REJECT_REASON_JA,
  SIGNAL_TYPE_JA,
  SIGNAL_TYPE_OUTCOME_JA,
} from "@/lib/proposer/labels-ja";
import { IntentSide, PreferredHorizon, PortfolioBucket } from "@/lib/intents";
import { RejectReasonSchema } from "@/lib/intents-reject";

describe("labels-ja", () => {
  it("maps all IntentSide values", () => {
    expect(SIDE_JA.accumulate).toBe("買い増し");
    expect(SIDE_JA.reduce).toBe("縮小");
    expect(SIDE_JA.enter_long).toBe("新規ロング");
    expect(SIDE_JA.avoid).toBe("回避");
  });
  it("maps all preferred_horizon", () => {
    expect(HORIZON_JA.position).toContain("中期");
    expect(HORIZON_JA["multi-week"]).toContain("1ヶ月");
  });
  it("maps all portfolio buckets", () => {
    expect(BUCKET_JA.core).toContain("中核");
    expect(BUCKET_JA.tactical).toContain("機動");
  });
  it("maps all 8 reject reasons", () => {
    expect(REJECT_REASON_JA.weak_invalidation).toContain("無効化");
    expect(REJECT_REASON_JA.thesis_disagree).toContain("仮説");
    expect(REJECT_REASON_JA.other).toContain("その他");
  });
});

describe("labels-ja exhaustiveness", () => {
  it("SIDE_JA covers every IntentSide (non-empty JA)", () => {
    for (const side of IntentSide.options) {
      expect(SIDE_JA[side]).toBeDefined();
      expect(SIDE_JA[side].length).toBeGreaterThan(0);
    }
  });

  it("HORIZON_JA covers every PreferredHorizon (non-empty JA)", () => {
    for (const h of PreferredHorizon.options) {
      expect(HORIZON_JA[h]).toBeDefined();
      expect(HORIZON_JA[h].length).toBeGreaterThan(0);
    }
  });

  it("BUCKET_JA covers every PortfolioBucket (non-empty JA)", () => {
    for (const b of PortfolioBucket.options) {
      expect(BUCKET_JA[b]).toBeDefined();
      expect(BUCKET_JA[b].length).toBeGreaterThan(0);
    }
  });

  it("REJECT_REASON_JA covers every RejectReason (non-empty JA)", () => {
    for (const r of RejectReasonSchema.options) {
      expect(REJECT_REASON_JA[r]).toBeDefined();
      expect(REJECT_REASON_JA[r].length).toBeGreaterThan(0);
    }
  });
});

describe("SIGNAL_TYPE maps invariants", () => {
  it("SIGNAL_TYPE_JA and SIGNAL_TYPE_OUTCOME_JA share the same keys", () => {
    // Re-import here since SIGNAL_TYPE_* already tested at top level
    const a = Object.keys(SIGNAL_TYPE_JA).sort();
    const b = Object.keys(SIGNAL_TYPE_OUTCOME_JA).sort();
    expect(a).toEqual(b);
  });
});
