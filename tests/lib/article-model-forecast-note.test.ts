import { describe, expect, it } from "vitest";

import { ArticleMetaSchema } from "@/lib/articles/article-model";

// 2026-11-23 (田平氏 GO・案 A): forecastNoteJa はサイクル予報だけが持つ
// (実体化した repo の meta.json もこの schema を通る — regimeNoteJa と同じ守り)
describe("ArticleMetaSchema — forecastNoteJa", () => {
  const base = {
    articleId: "cycle-forecast-20261123-f9082304",
    family: "cycle-forecast",
    titleJa: "ビットコイン、底の時期でも下げは過去の底の 6 割台｜サイクル予報 #1",
    publishedAtJst: "2026-11-23T18:22:00+09:00",
    publishedLabel: "11-23 18:22 公開",
  };
  const NOTE = "ビットコイン — 晴れ 1・くもり 4・雨 0（11 月 22 日の週）";

  it("accepts forecastNoteJa on a cycle-forecast article", () => {
    expect(ArticleMetaSchema.parse({ ...base, forecastNoteJa: NOTE }).forecastNoteJa).toBe(NOTE);
  });

  it("rejects forecastNoteJa on another family", () => {
    expect(
      ArticleMetaSchema.safeParse({ ...base, family: "signal", forecastNoteJa: NOTE }).success,
    ).toBe(false);
  });
});

// 2026-11-23 (田平氏承認): forecastRowsJa — カードの指標の表。サイクル予報だけ・形はサイトと発行側で同じ
describe("ArticleMetaSchema — forecastRowsJa", () => {
  const base = {
    articleId: "cycle-forecast-20261130-0123abcd",
    family: "cycle-forecast",
    titleJa: "見出し｜サイクル予報 #2",
    publishedAtJst: "2026-11-30T07:15:00+09:00",
    publishedLabel: "11-30 07:15 公開",
  };
  const ROWS = [
    { scope: "btc", weather: "sunny", label: "200 週移動平均", value: "200 週線の −10.4%" },
    { scope: "altseason", weather: "cloudy", label: "ETH/BTC 比", value: "90 日で −10.5%" },
  ];

  it("accepts forecastRowsJa on a cycle-forecast article", () => {
    expect(ArticleMetaSchema.parse({ ...base, forecastRowsJa: ROWS }).forecastRowsJa).toEqual(ROWS);
  });

  it("rejects forecastRowsJa on another family", () => {
    expect(
      ArticleMetaSchema.safeParse({ ...base, family: "signal", forecastRowsJa: ROWS }).success,
    ).toBe(false);
  });

  it.each([
    ["empty list", []],
    ["13 rows", Array.from({ length: 13 }, () => ROWS[0])],
    ["unknown weather", [{ ...ROWS[0], weather: "snow" }]],
    ["unknown scope", [{ ...ROWS[0], scope: "eth" }]],
    ["label over 40", [{ ...ROWS[0], label: "あ".repeat(41) }]],
    ["value over 60", [{ ...ROWS[0], value: "あ".repeat(61) }]],
    ["padded value", [{ ...ROWS[0], value: " MVRV 1.15" }]],
    ["newline in label", [{ ...ROWS[0], label: "200 週\n移動平均" }]],
    ["extra key", [{ ...ROWS[0], emoji: "☀" }]],
  ])("rejects a malformed table (%s)", (_name, rows) => {
    expect(ArticleMetaSchema.safeParse({ ...base, forecastRowsJa: rows }).success).toBe(false);
  });
});
