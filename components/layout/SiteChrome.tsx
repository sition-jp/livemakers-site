"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import type { SnapshotChromeMeta } from "@/lib/home/market-snapshot";

function isHiddenPreviewPath(pathname: string): boolean {
  return /^\/(?:en\/|ja\/)?terminal-preview\/?$/.test(pathname)
    || /^\/(?:en\/|ja\/)?article-inflow-preview(?:\/|$)/.test(pathname);
}

export function SiteChrome({
  children,
  chromeMeta,
  futureAtlasNav,
}: {
  children: React.ReactNode;
  chromeMeta: SnapshotChromeMeta;
  futureAtlasNav: boolean;
}) {
  const pathname = usePathname();

  if (isHiddenPreviewPath(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header chromeMeta={chromeMeta} futureAtlasNav={futureAtlasNav} />
      <main>{children}</main>
      <Footer futureAtlasNav={futureAtlasNav} />
    </>
  );
}
