import type { Metadata } from "next";

/**
 * 各ページが「自分自身」を canonical として名乗るための alternates
 * (2026-10-19 田平氏依頼: Google 検索「livemakers」でトップが一番上に出ない)。
 *
 * それまでは root layout が `canonical: "/ja"` を全ページの既定値として
 * 宣言しており、独自の metadata を持たない一覧・セッション・EN トップ等
 * 約 25 面が「このページはトップの重複です」と名乗っていた。中身の違う
 * ページが大量にトップを canonical 指定したため Google はその指定を
 * 信用せず、どれをトップとして扱うかを自前で選び直していた。
 *
 * `path` は locale 接頭辞の後ろ ("" = トップ, "/brief" など)。
 */
export function localeAlternates(
  locale: string,
  path = "",
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ja: `/ja${path}`,
      en: `/en${path}`,
      "x-default": `/ja${path}`,
    },
  };
}
