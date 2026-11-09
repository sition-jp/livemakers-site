import { readdirSync } from "node:fs";
import { join } from "node:path";

// Next.js が redirects の source を解釈するのと同じ実装 (型の宣言は同梱されていない)
// @ts-expect-error -- next/dist/compiled/path-to-regexp has no type declarations
import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
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
        "/:section(about|articles|brief|contact|editorial-policy|future-atlas|privacy|sessions|topics|turning-points|videos)/:path([^/.]+)+",
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

  // 規則が実際にどの URL に当たるかを、Next.js と同じ path-to-regexp で確かめる
  const loadGeneral = async () => {
    const general = (await loadRedirects()).find((rule) => rule.destination === "/ja/:section/:path*");
    if (!general) throw new Error("the unprefixed redirect rule is missing");
    return pathToRegexp(general.source) as RegExp;
  };

  // 本番 (Vercel) では、区分のトップ (`/about`) を `/ja/:section/:path*` で送ると path が空の
  // ぶん末尾にスラッシュが付き (`/ja/about/`)、そこからもう 1 回 308 で `/ja/about` へ送られていた
  // (2026-11-10 merge 後に本番で実測)。区分のトップは専用の規則で 1 回で送る。
  it("sends a section root in one hop, with its own rule placed before the general one", async () => {
    const redirects = await loadRedirects();
    const rootIndex = redirects.findIndex((rule) => rule.destination === "/ja/:section");
    const generalIndex = redirects.findIndex((rule) => rule.destination === "/ja/:section/:path*");
    expect(rootIndex).toBeGreaterThan(-1);
    expect(rootIndex).toBeLessThan(generalIndex);
    expect(redirects[rootIndex].permanent).toBe(true);
    const root = pathToRegexp(redirects[rootIndex].source) as RegExp;
    const general = await loadGeneral();
    for (const path of ["/about", "/articles", "/privacy", "/videos"]) {
      expect(root.test(path), `root ${path}`).toBe(true);
      expect(general.test(path), `general ${path}`).toBe(false);
    }
    for (const path of ["/about-us", "/search", "/ja", "/api", "/brief/2026-W20-brief", "/articles.xml"]) {
      expect(root.test(path), `root ${path}`).toBe(false);
    }
  });

  it("matches unprefixed pages of the public sections", async () => {
    const general = await loadGeneral();
    for (const path of [
      "/articles/signal-20260808-89911b15",
      "/articles/series/signal/page/3",
      "/sessions/2026-08-21-global-close",
      "/brief/2026-W20-brief",
    ]) {
      expect(general.test(path), path).toBe(true);
    }
  });

  it("does not match internal sections, prefixed URLs or look-alike names", async () => {
    const general = await loadGeneral();
    for (const path of [
      "/api/revalidate",
      "/search",
      "/terminal-preview",
      "/article-inflow-preview",
      "/subscribe",
      "/ja/articles/signal-20260808-89911b15",
      "/en/about",
      "/about-us",
      "/articles.xml",
    ]) {
      expect(general.test(path), path).toBe(false);
    }
  });

  // redirects() は public/ より先に評価される。静的ファイルに当たると、その
  // ファイルは /ja/… へ送られて 404 になる (public/brief/<号>/thumbnail-*.png は
  // Weekly Brief の og:image と hero の画像 — 全体レビューで実測した不具合)。
  it("never matches a static file under public/", async () => {
    const general = await loadGeneral();
    const walk = (dir: string, prefix: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name), `${prefix}/${entry.name}`)
          : [`${prefix}/${entry.name}`],
      );
    const files = walk(join(process.cwd(), "public"), "");
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain("/brief/2026-W21-brief/thumbnail-ja.png");
    const hit = files.filter((file) => general.test(file));
    expect(hit).toEqual([]);
  });
});
