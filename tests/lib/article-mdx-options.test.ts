import { evaluate } from "@mdx-js/mdx";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ARTICLE_MDX_OPTIONS } from "@/lib/articles/article-mdx-options";

async function renderArticleBody(source: string): Promise<string> {
  const { default: Content } = await evaluate(source, {
    ...runtime,
    ...ARTICLE_MDX_OPTIONS,
  });
  // mdast → hast はブロック要素の間と `<br>` の直後に整形用の改行を挟む。
  // 検査対象は段落テキスト内の改行なので、タグに接する整形改行だけを落とす。
  return renderToStaticMarkup(createElement(Content)).replace(/>\n</g, "><").replace(/<br\/>\n/g, "<br/>");
}

/**
 * site-first / mirror 本文は X 公開体裁で書かれ、「📊 数値スナップショット」
 * 「🗂 継続確認」「▫ その他の動き」などは 1 行 = 1 項目を単一改行で並べる。
 * CommonMark の既定では単一改行 (soft break) は空白へ潰れ、段落が 1 本に
 * つながって読めない (2026-09-08 田平氏指摘・livemakers.com 9/8 Daily Intel
 * で実測 `<br>` 0 件)。本文文字列 (feed checksum 契約) には触れず、描画層で
 * 単一改行を `<br>` へ昇格する。
 */
describe("article MDX options: single newlines render as line breaks", () => {
  it("is markdown (not MDX) so X-style bodies with braces and angle brackets keep compiling", () => {
    expect(ARTICLE_MDX_OPTIONS.format).toBe("md");
  });

  it("renders each single-newline line of a snapshot paragraph on its own line", async () => {
    const html = await renderArticleBody(
      [
        "📊 数値スナップショット",
        "",
        "BTC $79,785 ±0.00%｜ETH $2,498.18 +0.77%（9月7日時点・24時間変化）",
        "XRP $1.42 +0.13%｜SOL $105.46 +2.07%（同）",
        "Regime: 株式は軟調、金は上昇。",
      ].join("\n"),
    );

    expect(html).toContain(
      "（9月7日時点・24時間変化）<br/>XRP $1.42 +0.13%｜SOL $105.46 +2.07%（同）<br/>Regime: 株式は軟調、金は上昇。",
    );
  });

  it("keeps blank-line paragraphs separate and bullet lines with URLs on their own lines", async () => {
    const html = await renderArticleBody(
      [
        "▫ その他の動き",
        "",
        "・米国のデータセンターが過去最多になった https://example.com/a",
        "・英国が強硬な姿勢に転じた https://example.com/b",
        "",
        "🗂 継続確認",
        "",
        "・報道段階である。",
      ].join("\n"),
    );

    // GFM の autolink literal で URL は <a> になる (従来どおり)
    expect(html).toContain(
      '<p>・米国のデータセンターが過去最多になった <a href="https://example.com/a">https://example.com/a</a><br/>・英国が強硬な姿勢に転じた <a href="https://example.com/b">https://example.com/b</a></p>',
    );
    expect(html).toContain("<p>🗂 継続確認</p><p>・報道段階である。</p>");
  });

  it("puts a source list item's continuation URL line under its title", async () => {
    const html = await renderArticleBody(
      [
        "一次ソース / 関連リンク:",
        "- 財務省 国債金利情報（日次）",
        "  https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm",
        "- 日本銀行 公表予定",
        "  https://www.boj.or.jp/about/calendar/index.htm",
      ].join("\n"),
    );

    expect(html).toContain(
      '<li>財務省 国債金利情報（日次）<br/><a href="https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm">https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm</a></li>',
    );
    expect(html).toContain(
      '<li>日本銀行 公表予定<br/><a href="https://www.boj.or.jp/about/calendar/index.htm">https://www.boj.or.jp/about/calendar/index.htm</a></li>',
    );
  });
});
