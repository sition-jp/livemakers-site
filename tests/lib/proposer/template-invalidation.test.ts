import { describe, it, expect } from "vitest";
import { buildInvalidation } from "@/lib/proposer/template-invalidation";

describe("buildInvalidation — market price path", () => {
  it("positive direction uses 下抜け with downward threshold", () => {
    const result = buildInvalidation({
      primaryAsset: "ADA",
      direction: "positive",
      horizon: "position",
      outcomeSummary: "提案可決 / 委任量拡大",
      currentPrice: 0.251,
      expiresAt: "2026-05-19T00:00:00Z",
    });
    expect(result.usedPlaceholder).toBe(false);
    expect(result.text).toContain("ADA");
    expect(result.text).toContain("下抜け");
    // 0.251 * (1 - 0.12) = 0.22088 → formatted as "$0.221" approximately
    expect(result.text).toMatch(/\$0\.22[0-9]/);
    expect(result.text).toContain("2026-05-19");
    expect(result.text).toContain("提案可決");
    expect(result.text).toContain("仮説破棄");
  });

  it("negative direction uses 上抜け with upward threshold", () => {
    const result = buildInvalidation({
      primaryAsset: "BTC",
      direction: "negative",
      horizon: "swing",
      outcomeSummary: "regime 遷移",
      currentPrice: 100000,
      expiresAt: "2026-04-28T00:00:00Z",
    });
    expect(result.text).toContain("上抜け");
    // 100000 * (1 + 0.08) = 108000
    expect(result.text).toContain("108000");
  });

  it("neutral direction uses 両方向 (±)", () => {
    const result = buildInvalidation({
      primaryAsset: "ADA",
      direction: "neutral",
      horizon: "swing",
      outcomeSummary: "regime 遷移",
      currentPrice: 0.25,
      expiresAt: "2026-04-28T00:00:00Z",
    });
    expect(result.text).toMatch(/±|両|上抜け.*下抜け|下抜け.*上抜け/);
  });
});

describe("buildInvalidation — placeholder fallback", () => {
  it("uses <<MANUAL: ...>> when currentPrice is undefined", () => {
    const result = buildInvalidation({
      primaryAsset: "NIGHT",
      direction: "positive",
      horizon: "position",
      outcomeSummary: "マイルストーン達成",
      currentPrice: undefined,
      expiresAt: "2026-05-19T00:00:00Z",
    });
    expect(result.usedPlaceholder).toBe(true);
    expect(result.text).toContain("<<MANUAL:");
    expect(result.text).toContain("NIGHT");
    expect(result.text).toContain("2026-05-19");
    expect(result.text).toContain("マイルストーン達成");
  });
});

describe("buildInvalidation — non-positive price routes to placeholder", () => {
  it("treats currentPrice=0 as missing → placeholder", () => {
    const result = buildInvalidation({
      primaryAsset: "ADA",
      direction: "positive",
      horizon: "position",
      outcomeSummary: "テスト",
      currentPrice: 0,
      expiresAt: "2026-05-19T00:00:00Z",
    });
    expect(result.usedPlaceholder).toBe(true);
    expect(result.text).toContain("<<MANUAL:");
  });

  it("treats negative price as missing → placeholder", () => {
    const result = buildInvalidation({
      primaryAsset: "ADA",
      direction: "negative",
      horizon: "swing",
      outcomeSummary: "テスト",
      currentPrice: -1,
      expiresAt: "2026-05-19T00:00:00Z",
    });
    expect(result.usedPlaceholder).toBe(true);
    expect(result.text).toContain("<<MANUAL:");
  });
});

describe("buildInvalidation — horizon → threshold mapping", () => {
  const cases = [
    { horizon: "intraday" as const, threshold: 0.03, price: 100 },
    { horizon: "swing" as const, threshold: 0.08, price: 100 },
    { horizon: "position" as const, threshold: 0.12, price: 100 },
    { horizon: "multi-week" as const, threshold: 0.18, price: 100 },
  ];
  for (const { horizon, threshold, price } of cases) {
    it(`${horizon} uses ${threshold * 100}% threshold`, () => {
      const result = buildInvalidation({
        primaryAsset: "BTC",
        direction: "positive",
        horizon,
        outcomeSummary: "test outcome",
        currentPrice: price,
        expiresAt: "2026-12-31T00:00:00Z",
      });
      // For price 100 at integer formatting: 100 * (1 - threshold)
      // intraday: 97 / swing: 92 / position: 88 / multi-week: 82
      const expected = Math.round(price * (1 - threshold));
      expect(result.text).toContain(String(expected));
    });
  }
});

describe("buildInvalidation — price formatting", () => {
  it("formats small prices with 3 decimals (e.g., ADA)", () => {
    const result = buildInvalidation({
      primaryAsset: "ADA",
      direction: "positive",
      horizon: "position",
      outcomeSummary: "test",
      currentPrice: 0.251,
      expiresAt: "2026-05-19T00:00:00Z",
    });
    // 0.251 * 0.88 = 0.22088 → $0.221
    expect(result.text).toMatch(/\$0\.\d{3}/);
  });

  it("formats large prices as integers (e.g., BTC)", () => {
    const result = buildInvalidation({
      primaryAsset: "BTC",
      direction: "positive",
      horizon: "position",
      outcomeSummary: "test",
      currentPrice: 108200,
      expiresAt: "2026-05-19T00:00:00Z",
    });
    // 108200 * 0.88 = 95216, rendered as $95216 (integer)
    expect(result.text).toMatch(/\$\d{5,6}/);
  });
});
