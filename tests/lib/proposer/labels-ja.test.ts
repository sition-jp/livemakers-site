import { describe, it, expect } from "vitest";
import { SIDE_JA, HORIZON_JA, BUCKET_JA, REJECT_REASON_JA } from "@/lib/proposer/labels-ja";

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
