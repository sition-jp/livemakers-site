import { describe, expect, it } from "vitest";

import { extractToc } from "@/lib/articles/toc";

describe("extractToc", () => {
  it("extracts only h2 headings with stable ids", () => {
    const markdown = [
      "# タイトル",
      "リード文。",
      "## 最初の見出し",
      "本文。",
      "### 小見出しは拾わない",
      "## 二番目の見出し",
    ].join("\n");
    expect(extractToc(markdown)).toEqual([
      { id: "最初の見出し", text: "最初の見出し" },
      { id: "二番目の見出し", text: "二番目の見出し" },
    ]);
  });

  it("ignores fenced code blocks", () => {
    const markdown = [
      "## 実際の見出し",
      "```bash",
      "## これはコードでありコメント",
      "```",
      "~~~",
      "## こちらもコード",
      "~~~",
      "## もう一つの見出し",
    ].join("\n");
    expect(extractToc(markdown).map((item) => item.text)).toEqual([
      "実際の見出し",
      "もう一つの見出し",
    ]);
  });

  it("deduplicates repeated headings with ordinal suffixes", () => {
    const markdown = ["## 観測", "本文", "## 観測", "本文", "## 観測"].join("\n");
    expect(extractToc(markdown).map((item) => item.id)).toEqual([
      "観測",
      "観測-2",
      "観測-3",
    ]);
  });

  it("normalizes whitespace and ascii casing in ids", () => {
    const markdown = "## Fed  Watch 2026";
    expect(extractToc(markdown)).toEqual([
      { id: "fed-watch-2026", text: "Fed  Watch 2026" },
    ]);
  });

  it("returns every heading even when fewer than three exist (visibility is the caller's rule)", () => {
    expect(extractToc("## 単独見出し")).toHaveLength(1);
    expect(extractToc("本文だけ")).toEqual([]);
  });
});
