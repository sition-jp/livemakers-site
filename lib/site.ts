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

/**
 * トップ (と独自の og:image を持たない面) のリンクカード画像 (1200×630)。
 * 2026-11-10 田平氏: X のヘッダー (地平線の文字盤) と同じ絵に替えた。
 * X などはカード画像を URL ごとに長く覚えるので、絵を替えるときはファイル名も変える。
 * 元データ = sition-core `08_DOCS/reports/x_profiles/2026-11-10-lvm-og-home/`。
 */
export const HOME_OG_IMAGE_PATH = "/og-home-horizon.jpg";
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

/** `twitter:site` (X のカードに「この媒体のアカウント」として出る)。2026-11-09 到達の第 0 段。 */
export const X_SITE_HANDLE = `@${X_HANDLE}`;

/**
 * Organization の sameAs — 検索エンジンに「この媒体の公式アカウント」を示す
 * (2026-11-09 到達の第 0 段)。X と YouTube の 2 つ。
 */
export const ORGANIZATION_SAME_AS = [X_PROFILE_URL, YOUTUBE_CHANNEL_URL] as const;

/**
 * RSS の自動検出 (`<link rel="alternate" type="application/rss+xml">`) が指す先。
 * フィードは日本語版だけ (`app/ja/feed.xml`)。2026-11-09 到達の第 0 段。
 */
export const RSS_FEED_URL = `${SITE_URL}/ja/feed.xml`;
