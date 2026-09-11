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
