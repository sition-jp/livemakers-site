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

/**
 * 運営元 (事業者) の公式サイト。2026-10-16 田平氏決定で事業者名は「SITION」
 * (「SITION Group」表記は使わない)。フッターと連絡先ページが同じ値を参照する。
 */
export const SITION_URL = "https://sition.jp";

/**
 * 公式 X とフォロー導線 (2026-10-12 田平氏 GO)。ヘッダー・フッター・記事末の
 * フォロー枠・連絡先ページが同じ値を参照する。
 */
export const X_HANDLE = "LiveMakersCom";
export const X_PROFILE_URL = `https://x.com/${X_HANDLE}`;
/** 押すとフォロー確認画面が開く (X の埋め込みスクリプトは読まない)。 */
export const X_FOLLOW_URL = `https://x.com/intent/follow?screen_name=${X_HANDLE}`;

/** YouTube チャンネル (2026-10-28 開設・ハンドルは X と同じ)。動画一覧と動画の記事が参照する。 */
export const YOUTUBE_CHANNEL_URL = `https://www.youtube.com/@${X_HANDLE}`;

/**
 * Google 検索の「優先ソース」(トップニュースで優先表示)。Google ニュースの
 * 媒体ページ (フォロー) は自動生成のみで、livemakers.com にはまだ無い
 * (2026-10-12 実測) ため、こちらを使う。スクリプトが無くても開ける直リンク。
 */
export const GOOGLE_PREFERRED_SOURCE_URL =
  "https://www.google.com/preferences/source?q=livemakers.com";
