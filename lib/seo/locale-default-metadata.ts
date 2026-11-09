import type { Metadata } from "next";

import { SITE_NAME, X_SITE_HANDLE } from "@/lib/site";

/**
 * 日本語ページの既定のメタ情報 (2026-11-09 到達の第 0 段)。
 *
 * それまでは root layout (app/layout.tsx) の英語の title・description・
 * og:locale=en_US が /ja のトップにもそのまま出ていた。日本語の読者が
 * 「LiveMakers」で検索したときの見え方を日本語にするため、[locale] layout で
 * 日本語版の既定値を宣言する。独自のメタ情報を持つページ (記事・動画・
 * ブリーフ等) はこれを上書きするので影響しない。英語版は root の既定値のまま。
 */

const HOME_OG_IMAGE = {
  url: "/og-home.jpg",
  width: 1200,
  height: 630,
  alt: SITE_NAME,
};

export const JA_HOME_TITLE = "LiveMakers｜金融再起動のインテリジェンス・ターミナル";

export const JA_HOME_DESCRIPTION =
  "暗号資産・AI・量子・合成生物が、お金の流れと市場のルールを作り直している。その変化を一次情報から観測し、速報・Signal・Deep Dive・12指標で毎日届ける、金融再起動のインテリジェンス・ターミナル。";

export function localeDefaultMetadata(locale: string): Metadata {
  if (locale !== "ja") return {};
  return {
    // absolute: root layout の template (「%s | LiveMakers」) がこの既定値にも
    // かかって「… | LiveMakers」が二重になるのを防ぐ。子ページの title には
    // 引き続き同じ template がかかる。
    title: {
      absolute: JA_HOME_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    description: JA_HOME_DESCRIPTION,
    openGraph: {
      title: JA_HOME_TITLE,
      description: JA_HOME_DESCRIPTION,
      type: "website",
      locale: "ja_JP",
      alternateLocale: "en_US",
      siteName: SITE_NAME,
      images: [HOME_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      site: X_SITE_HANDLE,
      title: JA_HOME_TITLE,
      description: JA_HOME_DESCRIPTION,
      images: [HOME_OG_IMAGE.url],
    },
  };
}
