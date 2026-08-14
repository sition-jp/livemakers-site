"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { TickerBar } from "@/components/terminal/TickerBar";
import type { SnapshotChromeMeta } from "@/lib/home/market-snapshot";
import type { MarketTickerItem } from "@/lib/terminal/market-lanes";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";

function isHiddenPreviewPath(pathname: string): boolean {
  return /^\/(?:en\/|ja\/)?terminal-preview\/?$/.test(pathname)
    || /^\/(?:en\/|ja\/)?article-inflow-preview(?:\/|$)/.test(pathname);
}

/**
 * サイト共通 chrome (2026-08-14 田平氏指示で 3 段構成を全ページ化):
 * 1 段目 = logo + フラットナビ (Header) / 2 段目 = ticker /
 * 3 段目 = 来歴 + 注記 + 旧クラスタ (LIGHT/DARK・日付・SNAPSHOT・version)。
 * ticker/来歴は従来ホーム専用だったが、クラスタの移設に伴い共通化した
 * (どのページでもテーマ切替と鮮度表示に到達できる)。
 */
export function SiteChrome({
  children,
  chromeMeta,
  futureAtlasNav,
  tickerItems,
  pageProvenance,
}: {
  children: React.ReactNode;
  chromeMeta: SnapshotChromeMeta;
  futureAtlasNav: boolean;
  tickerItems: MarketTickerItem[];
  pageProvenance: WindowProvenance;
}) {
  const pathname = usePathname();
  const home = useTranslations("home");
  const nav = useTranslations("nav");

  if (isHiddenPreviewPath(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header futureAtlasNav={futureAtlasNav} />
      <TickerBar items={tickerItems} />
      <GlobalProvenanceStrip
        provenance={pageProvenance}
        labels={{
          review: home("provenance.review"),
          source: home("provenance.source"),
          asOf: home("provenance.asOf"),
          packet: home("provenance.packet"),
        }}
        note={home("provenance.note")}
        chromeMeta={chromeMeta}
        snapshotLabel={nav("snapshot")}
      />
      <main>{children}</main>
      <Footer futureAtlasNav={futureAtlasNav} />
    </>
  );
}
