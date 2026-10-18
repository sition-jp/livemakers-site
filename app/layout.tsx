import "./globals.css";
import type { Metadata } from "next";

// トップ (と openGraph を自前で宣言しない面) のリンクカード用画像。
// 記事詳細は article-metadata.ts が openGraph を丸ごと置き換えるので、
// サムネ付き記事はサムネ、サムネ無し記事 (mirror lane) は画像なしのまま。
const HOME_OG_IMAGE = {
  url: "/og-home.jpg",
  width: 1200,
  height: 630,
  alt: "LiveMakers",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://livemakers.com"),
  // 独自のタイトルを持つページは「〇〇 | LiveMakers」になる。持たない
  // ページ (トップ) は default のまま。
  title: {
    default: "LiveMakers — Intelligence Terminal for the Financial Reboot",
    template: "%s | LiveMakers",
  },
  description:
    "LiveMakers is the intelligence terminal of SITION for the financial reboot, powered by SDE — integrating crypto assets and blockchains, AI and robotics, quantum, synthetic biology, and macro/regulation into leading-indicator signals, forecasts, and actionable decisions.",
  // canonical / hreflang はここで既定値を持たない (2026-10-19)。以前は
  // `canonical: "/ja"` を置いていたため、独自の alternates を宣言しない
  // 全ページが「トップの重複」を名乗り、Google 検索でトップが上に出なく
  // なっていた。各ページが lib/seo/locale-alternates.ts で自分自身を宣言する。
  openGraph: {
    title: "LiveMakers — Intelligence Terminal for the Financial Reboot",
    description:
      "Crypto, AI, quantum, and synthetic biology are rebuilding finance — observed from the field by SITION (DRep #13 · SPO ×3 · Midnight Ambassador).",
    type: "website",
    locale: "en_US",
    alternateLocale: "ja_JP",
    siteName: "LiveMakers",
    images: [HOME_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "LiveMakers — Intelligence Terminal for the Financial Reboot",
    description:
      "Crypto, AI, quantum, and synthetic biology are rebuilding finance — observed from the field by SITION (DRep #13 · SPO ×3 · Midnight Ambassador).",
    images: [HOME_OG_IMAGE.url],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
