/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShareButtons, buildShareLinks } from "@/components/articles/ShareButtons";
import ja from "@/messages/ja.json";

const URL = "https://livemakers.com/ja/articles/signal-20261109-dfcfb3ed";
const TITLE = "📡 Signal｜テスト & 見出し";

describe("ShareButtons (記事末のシェアボタン)", () => {
  it("builds X / LINE / Hatena share URLs with the article URL and title encoded", () => {
    const links = buildShareLinks(URL, TITLE);
    const u = encodeURIComponent(URL);
    const t = encodeURIComponent(TITLE);
    expect(links.x).toBe(`https://x.com/intent/post?text=${t}&url=${u}&via=LiveMakersCom`);
    expect(links.line).toBe(`https://social-plugins.line.me/lineit/share?url=${u}`);
    expect(links.hatena).toBe(`https://b.hatena.ne.jp/add?mode=confirm&url=${u}&title=${t}`);
  });

  it("renders three external links that open in a new tab", () => {
    render(<ShareButtons url={URL} title={TITLE} copy={ja.share} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByRole("link", { name: /X でポスト/ })).toHaveAttribute(
      "href",
      buildShareLinks(URL, TITLE).x,
    );
    expect(screen.getByRole("complementary", { name: ja.share.heading })).toBeInTheDocument();
  });
});
