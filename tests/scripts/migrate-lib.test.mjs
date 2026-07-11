import { describe, expect, it } from "vitest";

import {
  applyBodyPatch,
  applyTitleTransform,
  escapeMdx,
  extractBody,
  publishedLabelFromJst,
} from "../../scripts/migrate-articles/lib.mjs";

const declaration = (overrides = {}) => ({
  bodySelector: "exact_marker",
  publicH2s: [],
  internalH2s: [],
  leadDuplicateLine: null,
  trailingHashtagLine: null,
  ...overrides,
});

describe("migrate lib v1.1", () => {
  it("applies declared exact prefix strip and rejects mismatch", () => {
    expect(
      applyTitleTransform({
        titleTransform: "strip_prefix",
        titlePrefix: "📋 Daily Intel 7/10｜",
        titleOriginal: "📋 Daily Intel 7/10｜停戦崩壊",
        titleJa: "停戦崩壊",
      }),
    ).toBe("停戦崩壊");
    expect(() =>
      applyTitleTransform({
        titleTransform: "strip_prefix",
        titlePrefix: "📡 Signal｜",
        titleOriginal: "📋 Daily Intel 7/10｜停戦崩壊",
        titleJa: "停戦崩壊",
      }),
    ).toThrow();
    expect(
      applyTitleTransform({
        titleTransform: "verbatim",
        titlePrefix: null,
        titleOriginal: "IntelのAI反撃はGPU単体ではない｜Xeon 6+",
        titleJa: "IntelのAI反撃はGPU単体ではない｜Xeon 6+",
      }),
    ).toBe("IntelのAI反撃はGPU単体ではない｜Xeon 6+");
  });

  it("keeps public H2s and cuts at the first internal H2", () => {
    const source = [
      "---", "a: b", "---", "", "## 投稿本文", "", "リード。", "",
      "## 1｜チャットから", "章本文。", "", "## 画像", "internal.png",
      "## 編集メモ", "メモ。",
    ].join("\n");
    const body = extractBody(
      source,
      declaration({
        publicH2s: ["## 1｜チャットから"],
        internalH2s: ["## 画像", "## 編集メモ"],
      }),
    );
    expect(body).toContain("## 1｜チャットから");
    expect(body).not.toContain("## 画像");
    expect(body).not.toContain("## 編集メモ");
  });

  it("matches internal H2s by the full line", () => {
    const source = [
      "---", "a: b", "---", "", "## 投稿本文", "", "リード。", "",
      "## 画像生成メモの読み方", "公開章。", "", "## 画像", "internal.png",
    ].join("\n");
    const body = extractBody(
      source,
      declaration({
        publicH2s: ["## 画像生成メモの読み方"],
        internalH2s: ["## 画像"],
      }),
    );
    expect(body).toContain("## 画像生成メモの読み方");
    expect(body).not.toContain("\n## 画像\n");
  });

  it("rejects uncovered and interleaved H2s", () => {
    const uncovered = [
      "---", "a: b", "---", "## 投稿本文", "## 未分類の見出し", "章。",
    ].join("\n");
    expect(() => extractBody(uncovered, declaration())).toThrow(/uncovered H2/);
    const interleaved = [
      "---", "a: b", "---", "## 投稿本文", "## 編集メモ", "内部。",
      "## 1｜公開章", "章。",
    ].join("\n");
    expect(() =>
      extractBody(
        interleaved,
        declaration({
          publicH2s: ["## 1｜公開章"],
          internalH2s: ["## 編集メモ"],
        }),
      ),
    ).toThrow(/interleave/);
  });

  it("removes only declared exact lead and hashtag lines", () => {
    const source = [
      "---", "a: b", "---", "", "## 投稿本文", "", "タイトル行", "",
      "本文。", "", "#BTC #ADA",
    ].join("\n");
    expect(
      extractBody(
        source,
        declaration({
          leadDuplicateLine: "タイトル行",
          trailingHashtagLine: "#BTC #ADA",
        }),
      ),
    ).toBe("本文。");
    expect(() =>
      extractBody(source, declaration({ leadDuplicateLine: "別の行" })),
    ).toThrow(/leadDuplicateLine/);
  });

  it("supports decorated, xcopy, and full selectors", () => {
    const decorated = ["---", "a: b", "---", "## 投稿本文（X Premium 長文）", "本文A。"].join("\n");
    expect(extractBody(decorated, declaration({ bodySelector: "decorated_marker" }))).toBe("本文A。");
    const xcopy = ["---", "a: b", "---", "## Xコピペ形式（投稿本文）", "本文X。"].join("\n");
    expect(extractBody(xcopy, declaration({ bodySelector: "xcopy_marker" }))).toBe("本文X。");
    const full = ["---", "a: b", "---", "", "本文B。"].join("\n");
    expect(extractBody(full, declaration({ bodySelector: "full_after_frontmatter" }))).toBe("本文B。");
  });

  it("verifies bodyPatch expectedCount", () => {
    expect(
      applyBodyPatch("a crawler b crawler", {
        approvedBy: "tabira",
        replacements: [{ from: "crawler", to: "収集系統", expectedCount: 2 }],
      }),
    ).toBe("a 収集系統 b 収集系統");
    expect(() =>
      applyBodyPatch("a crawler b", {
        approvedBy: "tabira",
        replacements: [{ from: "crawler", to: "収集系統", expectedCount: 2 }],
      }),
    ).toThrow(/expectedCount/);
  });

  it("escapes MDX outside code fences and derives the label", () => {
    expect(escapeMdx("60K<70K {注}")).toBe("60K\\<70K \\{注\\}");
    const fenced = "```\na < b { c }\n```";
    expect(escapeMdx(fenced)).toBe(fenced);
    expect(publishedLabelFromJst("2026-07-10T05:52:00+09:00")).toBe(
      "07-10 05:52 公開",
    );
  });
});
