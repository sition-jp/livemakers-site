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
      ],
    },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/sitemap-news.xml`],
  };
}
