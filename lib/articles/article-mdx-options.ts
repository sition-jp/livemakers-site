import type { CompileOptions } from "@mdx-js/mdx";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/**
 * 記事本文 (site-first / mirror) の MDX 設定。公開 route・preview route・
 * compile gate が同じ配列を共有する。
 *
 * - format "md": 本文は X 公開体裁の Markdown で、`{}` や `<` を MDX 式として
 *   解釈させない (従来どおり)。
 * - remark-breaks: 数値スナップショット・継続確認・その他の動き などは
 *   1 行 = 1 項目を単一改行で並べる。CommonMark 既定の soft break は空白へ
 *   潰れて段落が 1 本につながる (2026-09-08 田平氏指摘・9/8 Daily Intel で
 *   実測 `<br>` 0 件) ため、描画層で単一改行を `<br>` へ昇格する。本文文字列と
 *   feed checksum 契約 (source / display) には触れない。
 */
export const ARTICLE_MDX_OPTIONS = {
  format: "md",
  remarkPlugins: [remarkGfm, remarkBreaks],
} satisfies CompileOptions;
