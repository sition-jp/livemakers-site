/**
 * G3 (Google News / Discover readiness, 2026-09-11 田平氏 GO): サイト全体で
 * 共有する絶対 URL・組織情報の単一ソース。robots.ts / sitemap.ts /
 * sitemap-news.xml / feed.xml / JSON-LD が同じ値を参照することで、
 * ドメインやロゴパスの記述違いが起きないようにする。
 */

export const SITE_URL = "https://livemakers.com";

/** publisher.logo — 180×180 の実在 PNG (SVG は構造化データの互換性が
 * 落ちるため使わない。`app/apple-icon.png` を流用)。 */
export const SITE_LOGO_URL = `${SITE_URL}/apple-icon.png`;
export const SITE_LOGO_WIDTH = 180;
export const SITE_LOGO_HEIGHT = 180;

export const SITE_NAME = "LiveMakers";
export const EDITORIAL_DESK_NAME = "LiveMakers 編集デスク";
export const ABOUT_URL = `${SITE_URL}/ja/about`;
