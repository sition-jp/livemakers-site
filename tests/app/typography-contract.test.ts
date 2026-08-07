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
 * セレクタの assertion は**実ルールだけ**を対象にする。
 *
 * ⚠️ globals.css の解説コメントには、変更の経緯として旧セレクタ `:lang(ja) .prose`
 * が文字列で書かれている。生ソースに対して否定 assertion を書くと、実ルールが
 * 正しく `.prose:lang(ja)` へ直っていてもコメントの記述にヒットして落ちる
 * (逆に、コメントを消すと通ってしまい guard として機能しない)。
 */
const globalsRules = globalsCss.replace(/\/\*[\s\S]*?\*\//g, "");

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
    expect(globalsRules).toContain("--tw-prose-body: var(--lmk-text-body)");
    expect(globalsRules).not.toContain("--tw-prose-body: var(--lmk-text-secondary)");
  });
});

const articlePageSource = readFileSync(
  path.join(process.cwd(), "app", "[locale]", "articles", "[slug]", "page.tsx"),
  "utf-8",
);

describe("G48 D3: Japanese body typography reaches the default route", () => {
  it("marks the article body element as Japanese content", () => {
    // 既定ルートは html lang="en" (defaultLocale:"en" / localePrefix:"as-needed") だが
    // 本文は常に ja.md。要素側で lang を宣言してロケール経路に依存させない。
    const bodyDiv = articlePageSource.match(
      /<div\s+data-testid="article-inflow-public-body"[\s\S]*?>/,
    )?.[0] ?? "";
    expect(bodyDiv).toContain('lang="ja"');
  });

  it("scopes Japanese metrics to the element itself, not an ancestor", () => {
    // `:lang(ja) .prose` だと祖先 (html) が ja のときしか当たらない
    expect(globalsRules).not.toMatch(/:lang\(ja\)\s+\.prose/);
    expect(globalsRules).toMatch(/\.prose:lang\(ja\)/);
  });

  it("raises the Japanese prose base with a rem unit, not px", () => {
    expect(globalsRules).toMatch(/\.prose:lang\(ja\)\s*\{[^}]*font-size:\s*1\.0625rem/);
    expect(globalsRules).not.toMatch(/font-size:\s*17px/);
  });

  it("keeps the Japanese long-form line-height at 1.85 (2026-08-07 田平氏要望で 2 から一段詰め)", () => {
    expect(globalsRules).toMatch(
      /\.prose:lang\(ja\)\s+:where\(p, li, blockquote\)\s*\{[^}]*line-height:\s*1\.85/,
    );
  });

  it("keeps anchored prose headings clear of the sticky header on toc jumps", () => {
    expect(globalsRules).toMatch(
      /\.prose\s+:where\(h2\[id\], h3\[id\]\)\s*\{[^}]*scroll-margin-top/,
    );
  });
});

/**
 * 一次ソースの URL 横あふれ (2026-07-25 修正)。
 *
 * 記事本文の「一次ソース」節は裸の URL を書いており、remark-gfm の autolink
 * literal が `<a>` に変える。アンカーのテキストが URL そのもの = 既定の
 * `overflow-wrap: normal` では改行機会のない 1 語になるため、375px 幅では
 * 本文カラム (315px) を越えて描画され、祖先が全て overflow-x:visible なので
 * ページ全体が横スクロールした (実測 body.scrollWidth 704px / 全 127 記事)。
 */
describe("prose: unbreakable URLs must not overflow the column", () => {
  const proseBlocks = [...globalsRules.matchAll(/(?:^|\})\s*(\.prose[^{}]*)\{([^}]*)\}/g)];

  const blockFor = (selectorTest: (selector: string) => boolean) =>
    proseBlocks.filter(([, selector]) => selectorTest(selector.trim()));

  it("locates the .prose rules (guards the regex itself)", () => {
    // 抽出に失敗すると以降の assertion が空振りで PASS してしまう。
    expect(proseBlocks.length).toBeGreaterThan(0);
    expect(blockFor((s) => s === ".prose").length).toBeGreaterThan(0);
  });

  it("relaxes overflow-wrap on the bare .prose container", () => {
    const bare = blockFor((s) => s === ".prose")
      .map(([, , body]) => body)
      .join("\n");
    expect(bare).toMatch(/overflow-wrap:\s*break-word/);
  });

  it("does not scope the wrap fix to Japanese only", () => {
    // Weekly Brief (components/brief/BriefArticle.tsx) は実在の en.md を描画する。
    // `.prose:lang(ja)` 側だけに置くと英語面が直らない。
    const jaOnly = blockFor((s) => s.includes(":lang(ja)"))
      .map(([, , body]) => body)
      .join("\n");
    expect(jaOnly).not.toMatch(/overflow-wrap/);
  });

  it("does not reach for break-all, which would also break normal words", () => {
    // `word-break: break-all` は「収まらない語」に限定されず、通常の英単語まで
    // 任意位置で折る。日本語混じりの本文で可読性が落ちるため使わない。
    expect(globalsRules).not.toMatch(/word-break:\s*break-all/);
  });

  it("does not use overflow-wrap: anywhere, which resizes auto-layout tables", () => {
    // `anywhere` は min-content 幅にも効くため table-layout:auto の列幅が変わる。
    // Weekly Brief の表組みへ意図しない再レイアウトを持ち込まない。
    expect(globalsRules).not.toMatch(/overflow-wrap:\s*anywhere/);
  });
});
