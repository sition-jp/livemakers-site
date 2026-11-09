import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

/**
 * 2026-11-10 (サイト流入 第 1 段): 接頭辞なしの URL (`/articles/<slug>` など) は
 * proxy (next-intl) が 307 (一時) で `/ja/…` へ送っていた。一時の転送だと Google は
 * 転送元を正規 URL に選ぶことがある — Search Console で「重複。Google が別の正規
 * ページを選択」112 件・URL 検査で Google の選んだ正規 URL が `/articles/<slug>`
 * (2026-11-10 実測)。公開している区分は恒久 (308) で送る。
 */
const loadRedirects = async () => (await nextConfig.redirects?.()) ?? [];

describe("next.config redirects", () => {
  it("sends unprefixed public sections to /ja permanently, after the specific article-lane rules", async () => {
    const redirects = await loadRedirects();
    const index = redirects.findIndex((rule) => rule.destination === "/ja/:section/:path*");
    expect(index).toBeGreaterThan(-1);
    expect(redirects[index]).toEqual({
      source:
        "/:section(about|articles|brief|contact|editorial-policy|future-atlas|privacy|sessions|topics|turning-points|videos)/:path*",
      destination: "/ja/:section/:path*",
      permanent: true,
    });
    // 個別の旧 URL (/brief/2026-W35-brief → 記事) が先に当たること
    const specific = redirects.findIndex((rule) => rule.source === "/brief/2026-W35-brief");
    expect(specific).toBeGreaterThan(-1);
    expect(specific).toBeLessThan(index);
  });

  it("keeps the root redirect permanent", async () => {
    const redirects = await loadRedirects();
    expect(redirects[0]).toEqual({ source: "/", destination: "/ja", permanent: true });
  });

  it("does not touch internal or preview sections", async () => {
    const redirects = await loadRedirects();
    const general = redirects.find((rule) => rule.destination === "/ja/:section/:path*");
    for (const section of ["api", "search", "terminal-preview", "article-inflow-preview", "subscribe", "ja", "en"]) {
      expect(general?.source.includes(`|${section}|`) || general?.source.includes(`(${section}|`) || general?.source.includes(`|${section})`)).toBe(false);
    }
  });
});
