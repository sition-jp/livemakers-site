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
  title: "LiveMakers — Intelligence Terminal for the Financial Reboot",
  description:
    "LiveMakers is the intelligence terminal of SITION Group for the financial reboot, powered by SDE — integrating crypto assets and blockchains, AI and robotics, quantum, synthetic biology, and macro/regulation into leading-indicator signals, forecasts, and actionable decisions.",
  // G3 (2026-09-11): <head> hreflang の既定値。個別ページ (記事詳細など)
  // が独自の `alternates` を宣言すればこれを丸ごと上書きする — Next.js の
  // metadata マージはフィールド単位の置き換えであり深いマージではない。
  // ここはその置き換えが起きないページ (トップ・About 等) 向けの既定。
  alternates: {
    canonical: "/ja",
    languages: { ja: "/ja", en: "/en", "x-default": "/ja" },
  },
  openGraph: {
    title: "LiveMakers — Intelligence Terminal for the Financial Reboot",
    description:
      "Crypto, AI, quantum, and synthetic biology are rebuilding finance — observed from the field by SITION Group (DRep #13 · SPO ×3 · Midnight Ambassador).",
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
      "Crypto, AI, quantum, and synthetic biology are rebuilding finance — observed from the field by SITION Group (DRep #13 · SPO ×3 · Midnight Ambassador).",
    images: [HOME_OG_IMAGE.url],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
