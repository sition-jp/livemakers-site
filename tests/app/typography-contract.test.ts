import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  path.join(process.cwd(), "app", "[locale]", "layout.tsx"),
  "utf-8",
);

const globalsCss = readFileSync(
  path.join(process.cwd(), "app", "globals.css"),
  "utf-8",
);

/**
 * テーマ宣言ブロックの本文を取り出す。
 *
 * ⚠️ `indexOf('[data-theme="dark"]')` は使えない — globals.css 冒頭の解説コメントに
 * `html[data-theme="dark"]` という文字列があり、実ルールより先にヒットしてしまう
 * (実測: コメント offset 250 / 実ルール offset 2324)。セレクタが**行頭から始まる**
 * ことを `^` (m フラグ) で要求して実ルールだけを掴む。
 */
const LIGHT_BLOCK =
  globalsCss.match(/^:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/m)?.[1] ?? "";
const DARK_BLOCK =
  globalsCss.match(/^\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/m)?.[1] ?? "";

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

describe("G48 D2: body ink token", () => {
  it("locates both theme blocks (guards the regex itself)", () => {
    expect(LIGHT_BLOCK).toContain("--lmk-text-primary: #1b2523");
    expect(DARK_BLOCK).toContain("--lmk-text-primary: #e6ecea");
  });

  it("defines --lmk-text-body in the light theme", () => {
    expect(LIGHT_BLOCK).toContain("--lmk-text-body: #3f4a47");
  });

  it("defines --lmk-text-body in the dark theme", () => {
    expect(DARK_BLOCK).toContain("--lmk-text-body: #c3cecb");
  });

  it("wires prose body ink to the new token, not text-secondary", () => {
    expect(globalsCss).toContain("--tw-prose-body: var(--lmk-text-body)");
    expect(globalsCss).not.toContain("--tw-prose-body: var(--lmk-text-secondary)");
  });
});
