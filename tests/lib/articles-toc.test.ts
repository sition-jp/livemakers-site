import { describe, expect, it } from "vitest";

import {
  classifyMarkerHeading,
  extractToc,
  hasDailyIntelBlockHeadings,
} from "@/lib/articles/toc";

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

describe("extractToc marker headings (X 公開体裁の平文マーカー)", () => {
  it("promotes standalone ■ lines in a signal-style body", () => {
    const markdown = [
      "リード文。",
      "",
      "■ 発表されたこと",
      "",
      "本文。",
      "",
      "■ 効いているのは、上限がないほう",
      "",
      "本文。",
      "",
      "■ 今後 48-72 時間",
      "",
      "・観察点",
    ].join("\n");
    expect(extractToc(markdown)).toEqual([
      { id: "■-発表されたこと", text: "■ 発表されたこと" },
      { id: "■-効いているのは、上限がないほう", text: "■ 効いているのは、上限がないほう" },
      { id: "■-今後-48-72-時間", text: "■ 今後 48-72 時間" },
    ]);
  });

  it("skips a ■ line that continues into the next plain-text line (not a standalone paragraph)", () => {
    const markdown = ["前段。", "", "■ 見出しではない", "続きの本文がそのまま繋がる。"].join("\n");
    expect(extractToc(markdown)).toEqual([]);
  });

  it("keeps a ■ line standalone when a markdown list interrupts it (daily-intel 重要な動き)", () => {
    const markdown = ["前段。", "", "■ 重要な動き", "- 項目 https://example.com"].join("\n");
    expect(extractToc(markdown)).toEqual([
      { id: "■-重要な動き", text: "■ 重要な動き" },
    ]);
  });

  it("promotes daily-intel block emojis and demotes ■/▫ to sub-level in that context", () => {
    const markdown = [
      "📋 Daily Intel 8/3｜タイトル行は昇格しない",
      "",
      "🎯 今日の主役",
      "",
      "本文。",
      "",
      "🧭 今日の焦点 3 件",
      "",
      "本文。",
      "",
      "⚡ 先行指標 Watch（48-72h）",
      "",
      "【1】観察点",
      "",
      "📎 直近24時間の動き",
      "",
      "■ 重要な動き",
      "- 項目",
      "",
      "▫ その他の動き",
      "・一行 https://example.com",
    ].join("\n");
    expect(extractToc(markdown).map((item) => item.text)).toEqual([
      "🎯 今日の主役",
      "🧭 今日の焦点 3 件",
      "⚡ 先行指標 Watch（48-72h）",
      "📎 直近24時間の動き",
    ]);
  });

  it("does not promote footer / related-link emoji lines (📌 🌐 は対象外)", () => {
    const markdown = [
      "本文。",
      "",
      "📌 関連記事: タイトル https://x.com/SITIONjp/status/1",
      "",
      "🌐 https://sition.jp / 🪙 https://sipo.tokyo",
    ].join("\n");
    expect(extractToc(markdown)).toEqual([]);
  });

  it("ignores marker lines inside code fences", () => {
    const markdown = ["```", "■ コード内", "```", "", "■ 実見出し", ""].join("\n");
    expect(extractToc(markdown).map((item) => item.text)).toEqual(["■ 実見出し"]);
  });
});

describe("classifyMarkerHeading / hasDailyIntelBlockHeadings", () => {
  it("classifies ■ as h2 outside daily-intel context and h3 inside", () => {
    expect(classifyMarkerHeading("■ 発表されたこと", false)).toEqual({ level: 2 });
    expect(classifyMarkerHeading("■ 重要な動き", true)).toEqual({ level: 3 });
    expect(classifyMarkerHeading("▫ その他の動き", true)).toEqual({ level: 3 });
    expect(classifyMarkerHeading("🎯 今日の主役", true)).toEqual({ level: 2 });
    expect(classifyMarkerHeading("📋 Daily Intel 8/3｜タイトル", true)).toBeNull();
    expect(classifyMarkerHeading("📌 関連記事: 何か", false)).toBeNull();
    expect(classifyMarkerHeading("■マーカー直後に空白が無い行", false)).toBeNull();
    expect(classifyMarkerHeading("本文の通常行", false)).toBeNull();
  });

  it("detects daily-intel context from block emoji lines", () => {
    expect(hasDailyIntelBlockHeadings("🎯 今日の主役\n\n本文。")).toBe(true);
    expect(hasDailyIntelBlockHeadings("リード。\n\n■ 発表されたこと\n\n本文。")).toBe(false);
  });
});
