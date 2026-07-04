"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

function isTerminalPreviewPath(pathname: string): boolean {
  return /^\/(?:en\/|ja\/)?terminal-preview\/?$/.test(pathname);
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isTerminalPreviewPath(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
