import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LiveMakers — Intelligence Terminal",
  description:
    "Cardano & Midnight institutional research, weekly brief, and real-time terminal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
