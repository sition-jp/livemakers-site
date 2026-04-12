import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "LiveMakers — Next-generation finance, written with institutional precision and lifestyle utility",
  description:
    "LiveMakers is the intelligence hub of SITION Group, covering the AI agent economy, crypto assets, decentralized finance, and AI auto-trading from a Cardano + Midnight vantage point. We translate the same primary research for two audiences: institutional researchers who need rigor, and individuals who want to integrate new investment styles into their daily life.",
  openGraph: {
    title: "LiveMakers — Cardano & Midnight Intelligence Hub",
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
