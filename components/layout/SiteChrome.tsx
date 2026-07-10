"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import type { SnapshotChromeMeta } from "@/lib/home/market-snapshot";

function isTerminalPreviewPath(pathname: string): boolean {
  return /^\/(?:en\/|ja\/)?terminal-preview\/?$/.test(pathname);
}

export function SiteChrome({
  children,
  chromeMeta,
}: {
  children: React.ReactNode;
  chromeMeta: SnapshotChromeMeta;
}) {
  const pathname = usePathname();

  if (isTerminalPreviewPath(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header chromeMeta={chromeMeta} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
