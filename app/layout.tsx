import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LiveMakers — Intelligence Terminal for Next-Generation Finance",
  description:
    "LiveMakers is the intelligence terminal of SITION Group, covering the AI agent economy, crypto assets, decentralized finance, and AI auto-trading from a Cardano + Midnight vantage point. Deep insight meets lifestyle utility — the same primary data serves institutional researchers and individuals integrating new investment styles into daily life.",
  openGraph: {
    title: "LiveMakers — Intelligence Terminal for Next-Generation Finance",
    description:
      "AI agent economy, crypto, DeFi, and AI auto-trading — observed from the Cardano + Midnight frontline by SITION Group (DRep #13 · SPO ×3 · Midnight Ambassador).",
    type: "website",
    locale: "en_US",
    alternateLocale: "ja_JP",
    siteName: "LiveMakers",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
