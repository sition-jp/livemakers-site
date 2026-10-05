import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import {
  createSourceCardCollector,
  isEmbeddedMediaUrl,
  isSourceHeadingText,
  MAX_SOURCE_CARDS,
} from "@/lib/articles/source-links";

async function collect(body: string) {
  const collector = createSourceCardCollector();
  const { default: Content } = await evaluate(body, {
    ...runtime,
    remarkPlugins: [remarkGfm, collector.remarkPlugin],
  });
  return { links: collector.links, html: renderToStaticMarkup(runtime.jsx(Content, {})) };
}

describe("isSourceHeadingText", () => {
  it.each(["参照", "■ 一次ソース", "🔗 一次ソース", "一次ソース:", "一次ソース：", "一次ソース / 関連リンク"])(
    "accepts %s",
    (text) => expect(isSourceHeadingText(text)).toBe(true),
  );
  it.each(["一次ソースの話", "参照先", "その他の動き"])("rejects %s", (text) =>
    expect(isSourceHeadingText(text)).toBe(false),
  );
});

describe("isEmbeddedMediaUrl", () => {
  it("matches X and YouTube hosts only", () => {
    for (const url of [
      "https://x.com/a/status/1",
      "https://twitter.com/a/status/1",
      "https://mobile.twitter.com/a/status/1",
      "https://www.youtube.com/watch?v=WpGs7DKe8QY",
      "https://m.youtube.com/watch?v=WpGs7DKe8QY",
      "https://youtu.be/WpGs7DKe8QY",
    ]) {
      expect(isEmbeddedMediaUrl(url), url).toBe(true);
    }
    expect(isEmbeddedMediaUrl("https://notx.com/a")).toBe(false);
    expect(isEmbeddedMediaUrl("https://example.com/")).toBe(false);
  });
});

describe("createSourceCardCollector", () => {
  it("marks card items under a heading and skips X / YouTube / 0-link / 2-link items", async () => {
    const { links, html } = await collect(
      [
        "本文。",
        "",
        "## 参照",
        "",
        "- [アルペン発表](https://digitalpr.jp/r/1)",
        "- [公式 X](https://x.com/alpen/status/1)",
        "- [BE-PAL の紹介記事](https://www.bepal.net/archives/2)",
        "- リンクなしの項目",
        "- [A](https://a.example.com/) と [B](https://b.example.com/)",
      ].join("\n"),
    );
    expect(links).toEqual([
      { url: "https://digitalpr.jp/r/1", label: "アルペン発表" },
      { url: "https://www.bepal.net/archives/2", label: "BE-PAL の紹介記事" },
    ]);
    expect(html).toContain('data-source-url="https://digitalpr.jp/r/1"');
    expect(html).toContain('data-source-label="アルペン発表"');
    expect(html).not.toContain('data-source-url="https://x.com/alpen/status/1"');
    expect((html.match(/data-source-url=/g) ?? []).length).toBe(2);
  });

  it("accepts paragraph-style headings (🔗 一次ソース / **一次ソース:**)", async () => {
    expect((await collect("🔗 一次ソース\n- [A](https://a.example.com/)")).links).toHaveLength(1);
    expect((await collect("**一次ソース:**\n\n- [A](https://a.example.com/)")).links).toHaveLength(1);
  });

  it("ignores lists that do not directly follow the heading", async () => {
    expect((await collect("## 参照\n\n説明文。\n\n- [A](https://a.example.com/)")).links).toEqual([]);
  });

  it("uses the surrounding text as the label for a bare autolink", async () => {
    const { links } = await collect("## 参照\n\n- アルペン発表 https://digitalpr.jp/r/1");
    expect(links).toEqual([{ url: "https://digitalpr.jp/r/1", label: "アルペン発表" }]);
  });

  it("drops the trailing colon/dash of a text-derived label (`- 出典名: https://…`)", async () => {
    const { links } = await collect(
      [
        "## 参照",
        "",
        "- BEA release schedule: https://www.bea.gov/news/schedule",
        "- 日銀 声明 ： https://www.boj.or.jp/a",
        "- Fed — https://www.federalreserve.gov/a",
        "- [Ratio: 1:1](https://r.example.com/)",
      ].join("\n"),
    );
    expect(links.map((link) => link.label)).toEqual([
      "BEA release schedule",
      "日銀 声明",
      "Fed",
      "Ratio: 1:1",
    ]);
  });

  it(`caps the cards at ${MAX_SOURCE_CARDS}`, async () => {
    const items = Array.from({ length: 10 }, (_, i) => `- [S${i}](https://s${i}.example.com/)`);
    const { links, html } = await collect(["## 参照", "", ...items].join("\n"));
    expect(links).toHaveLength(MAX_SOURCE_CARDS);
    expect(html).not.toContain('data-source-url="https://s8.example.com/"');
  });
});
