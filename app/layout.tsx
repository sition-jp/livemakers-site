import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://livemakers.com"),
  title: "LiveMakers — Intelligence Terminal for Next-Generation Finance",
  description:
    "LiveMakers is the next-generation financial intelligence terminal of SITION Group, powered by SDE — integrating crypto assets, DeFi, the AI agent economy, auto-trading, and macro/regulation from a Cardano + Midnight vantage point into leading-indicator signals, forecasts, and actionable decisions.",
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
