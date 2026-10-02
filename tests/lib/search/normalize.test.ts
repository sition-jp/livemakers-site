import { describe, expect, it } from "vitest";
import { normalizeForSearch } from "@/lib/search/normalize";

describe("normalizeForSearch", () => {
  it("folds full-width alphanumerics and case", () => {
    expect(normalizeForSearch("ＭＩＤＮＩＧＨＴ　Ｅｔｆ")).toBe("midnight etf");
  });
  it("folds half-width katakana", () => {
    expect(normalizeForSearch("ﾋﾞｯﾄｺｲﾝ")).toBe("ビットコイン");
  });
  it("collapses whitespace runs and trims", () => {
    expect(normalizeForSearch("  a \n\t b  ")).toBe("a b");
  });
});
