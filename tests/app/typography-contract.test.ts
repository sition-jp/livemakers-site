import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  path.join(process.cwd(), "app", "[locale]", "layout.tsx"),
  "utf-8",
);

/**
 * G48 D1 — フォント適用の構造ガード。
 *
 * globals.css の `--font-sans` は `@theme` により `:root` で宣言される。その値は
 * `var(--font-inter)` / `var(--font-noto-sans-jp)` を参照するため、これらが `:root`
 * （= <html>）に存在しないと `--font-sans` は guaranteed-invalid になり、<body> は
 * その空値を継承して Tailwind 既定の ui-sans-serif へ落ちる（2026-07-25 本番で実証）。
 * したがって next/font の variable class は必ず <html> 側に置く。
 */
describe("G48 D1: next/font variable classes", () => {
  // ⚠️ ファイル全体を match してはいけない — 上記の解説コメントが `<html>` /
  // `<body>` という文字列を含むため、`.match()` が実 JSX より先にコメントを掴む
  // (掴んだ場合 `<body>` 側の否定 assertion が空振りで PASS してしまう)。
  // JSX (return 以降) だけを対象にする。
  const jsx = layoutSource.slice(layoutSource.indexOf("return ("));
  const htmlTag = jsx.match(/<html[\s\S]*?>/)?.[0] ?? "";
  const bodyTag = jsx.match(/<body[\s\S]*?>/)?.[0] ?? "";

  it("applies both font variables on <html>", () => {
    // 実 JSX の <html> を掴めていることの自己ガード。抽出に失敗すると
    // htmlTag は "" になり、この assertion が必ず落ちる。
    expect(htmlTag).toContain("lang={locale}");
    expect(htmlTag).toContain("inter.variable");
    expect(htmlTag).toContain("notoSansJp.variable");
  });

  it("does not leave the font variables on <body>", () => {
    expect(bodyTag).not.toContain("inter.variable");
    expect(bodyTag).not.toContain("notoSansJp.variable");
  });
});
