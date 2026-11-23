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
