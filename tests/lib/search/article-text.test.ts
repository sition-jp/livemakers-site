import { describe, expect, it } from "vitest";
import {
  SEARCH_TEXT_MAX_CHARS,
  articleSearchText,
} from "@/lib/search/article-text";

// SDE 側 livemakers_export/tests/test_search_index_builder.py と同じ入出力
describe("articleSearchText (text rules v1)", () => {
  it("strips the title line, links, urls and markers", () => {
    const body =
      "T\n■ 見出し\n**太字** と [リンク](https://example.com/a) " +
      "https://x.com/s/1\n> 引用 | 表\n▫ 項目 `code`\n";
    expect(articleSearchText(body, "T")).toEqual({
      text: "見出し 太字 と リンク 引用 表 項目 code",
      truncated: false,
    });
  });

  it("keeps a first line that is not exactly the title", () => {
    expect(articleSearchText("Tの話\n本文", "T").text).toBe("Tの話 本文");
  });

  it("truncates by code points", () => {
    const { text, truncated } = articleSearchText(
      "😀".repeat(SEARCH_TEXT_MAX_CHARS + 5),
      "x",
    );
    expect(Array.from(text)).toHaveLength(SEARCH_TEXT_MAX_CHARS);
    expect(truncated).toBe(true);
  });
});
