import { describe, expect, it } from "vitest";
import { bodySnippet } from "@/lib/search/snippet";

describe("bodySnippet", () => {
  it("cuts around the first case-insensitive match with ellipses", () => {
    const raw = `${"あ".repeat(60)}Bitcoin の話${"い".repeat(60)}`;
    expect(bodySnippet(raw, ["bitcoin"], 10)).toBe(
      // 一致語の前後 10 文字ずつ (後ろ = 「 の話」3 文字 + 「い」7 文字)
      `…${"あ".repeat(10)}Bitcoin の話${"い".repeat(7)}…`,
    );
  });

  it("uses the earliest of several terms and no leading ellipsis at the start", () => {
    expect(bodySnippet("ETF と日銀の話", ["日銀", "etf"], 40)).toBe(
      "ETF と日銀の話",
    );
  });

  it("falls back to the head when no term is literally present", () => {
    const raw = "Ｂｉｔｃｏｉｎ" + "う".repeat(100);
    expect(bodySnippet(raw, ["bitcoin"], 40)).toBe(
      `${Array.from(raw).slice(0, 80).join("")}…`,
    );
  });
});
