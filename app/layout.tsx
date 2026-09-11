import "./globals.css";
import type { Metadata } from "next";

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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
