import { describe, expect, it } from "vitest";

import { ARTICLE_FAMILIES } from "@/lib/articles/article-model";
import { FAMILY_MARK, familyBadgeText } from "@/lib/articles/family-mark";

/**
 * 題から種類のラベル (📡 Signal｜ など) を外す前に、種類の印をバッジへ移す
 * (2026-11-16 題のラベルを外す設計 §5)。印の対応表はサイトでこの 1 か所だけ。
 */
describe("lib/articles/family-mark", () => {
  it("has exactly one entry per article family (a new family must be added here)", () => {
    expect(Object.keys(FAMILY_MARK).sort()).toEqual([...ARTICLE_FAMILIES].sort());
  });

  it("uses the emoji of today's title labels", () => {
    expect(FAMILY_MARK).toEqual({
      "daily-intel": "📋",
      signal: "📡",
      "deep-dive": "🔬",
      "weekly-brief": "📊",
      landmark: "📍",
      "event-risk-radar": "📌",
      "restart-map": "🗺️",
      "cycle-forecast": "🌤",
      "future-map": "🔭",
      "mkt12-morning": "📈",
      "mkt12-weekend": "📈",
      session: "",
      "future-atlas": "",
      flash: "",
    });
  });

  it("keeps the variation selector on the restart-map mark (U+1F5FA U+FE0F)", () => {
    expect([...FAMILY_MARK["restart-map"]].map((c) => c.codePointAt(0))).toEqual([
      0x1f5fa, 0xfe0f,
    ]);
  });

  it("prefixes the family name with its mark and a space", () => {
    expect(familyBadgeText("signal", "Signal")).toBe("📡 Signal");
    expect(familyBadgeText("landmark", "節目シグナル")).toBe("📍 節目シグナル");
  });

  it("leaves the name alone for families without a mark", () => {
    expect(familyBadgeText("session", "セッション記事")).toBe("セッション記事");
    expect(familyBadgeText("flash", "速報")).toBe("速報");
    expect(familyBadgeText("future-atlas", "未来アトラス")).toBe("未来アトラス");
  });
});
