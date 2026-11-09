import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * G3 (2026-09-11 田平氏 GO): robots.txt が 404 だった穴を塞ぐ。
 *
 * disallow の 2 ルートは既存の `robots: { index: false, follow: false }`
 * page-level metadata と同じ対象 — article-inflow-preview (T7b hidden
 * preview) と terminal-preview (フィクスチャ確認用)。ここでの disallow は
 * クローラの巡回自体を止める粗い網、page 側の noindex meta は個別 URL が
 * 直接踏まれた場合の保険として両方残す。
 *
 * `?_rsc=` (2026-11-10 田平氏 GO・案 C): Next.js がページ間の移動とリンクの
 * 先読みで取りに行く RSC の中身。Googlebot の取得の約 7 割がこの URL に使われ、
 * 記事の HTML を読みに来る量が足りなくなっていた (core
 * `08_DOCS/reports/growth/2026-11-09-lvm-google-impressions-drop-root-cause.md`
 * §3.2)。記事の本文は最初の HTML に全部入っているので、Google の描画には
 * 要らない。`_rsc` が 2 つ目以降の引数になる形 (`&_rsc=`) も止める。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/ja/article-inflow-preview",
        "/en/article-inflow-preview",
        "/ja/terminal-preview",
        "/en/terminal-preview",
        "/*?_rsc=",
        "/*&_rsc=",
      ],
    },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/sitemap-news.xml`],
  };
}
