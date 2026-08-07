/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createArticleMdxComponents } from "@/components/articles/ArticleBodyComponents";

const SIGNAL_BODY = ["リード文。", "", "■ 発表されたこと", "", "本文。"].join("\n");
const DAILY_INTEL_BODY = [
  "📋 Daily Intel 8/3｜タイトル",
  "",
  "🎯 今日の主役",
  "",
  "本文。",
  "",
  "📎 直近24時間の動き",
  "",
  "■ 重要な動き",
  "- 項目",
].join("\n");

describe("createArticleMdxComponents", () => {
  it("promotes a single-line ■ paragraph to h2 with a toc-compatible id", () => {
    const { p: P } = createArticleMdxComponents(SIGNAL_BODY);
    const { container } = render(<P>■ 発表されたこと</P>);
    const heading = container.querySelector("h2")!;
    expect(heading).not.toBeNull();
    expect(heading.id).toBe("■-発表されたこと");
    expect(heading.textContent).toBe("■ 発表されたこと");
    expect(container.querySelector("p")).toBeNull();
  });

  it("demotes ■/▫ to h3 when the body carries daily-intel block headings", () => {
    const { p: P } = createArticleMdxComponents(DAILY_INTEL_BODY);
    const important = render(<P>■ 重要な動き</P>);
    expect(important.container.querySelector("h3")).not.toBeNull();
    expect(important.container.querySelector("h2")).toBeNull();
    const block = render(<P>🎯 今日の主役</P>);
    expect(block.container.querySelector("h2")).not.toBeNull();
  });

  it("leaves multi-line and non-plain-text paragraphs untouched", () => {
    const { p: P } = createArticleMdxComponents(SIGNAL_BODY);
    const multiline = render(<P>{"▫ その他の動き\n・一行 https://example.com"}</P>);
    expect(multiline.container.querySelector("p")).not.toBeNull();
    expect(multiline.container.querySelector("h2, h3")).toBeNull();
    const withElement = render(
      <P>
        ■ リンク入り<a href="https://example.com">x</a>
      </P>,
    );
    expect(withElement.container.querySelector("p")).not.toBeNull();
  });

  it("leaves title / footer emoji lines as paragraphs (📋 📡 📌 は昇格しない)", () => {
    const { p: P } = createArticleMdxComponents(DAILY_INTEL_BODY);
    for (const line of [
      "📋 Daily Intel 8/3｜タイトル",
      "📡 Signal｜見出し",
      "📌 関連記事: タイトル",
    ]) {
      const { container } = render(<P>{line}</P>);
      expect(container.querySelector("p"), line).not.toBeNull();
      expect(container.querySelector("h2, h3"), line).toBeNull();
    }
  });

  it("shares ordinal id dedup between markdown h2 and promoted markers", () => {
    const { h2: H2, p: P } = createArticleMdxComponents(SIGNAL_BODY);
    const first = render(<H2>観測</H2>);
    const second = render(<P>■ 観測</P>);
    const third = render(<H2>観測</H2>);
    expect(first.container.querySelector("h2")!.id).toBe("観測");
    expect(second.container.querySelector("h2")!.id).toBe("■-観測");
    expect(third.container.querySelector("h2")!.id).toBe("観測-2");
  });
});
