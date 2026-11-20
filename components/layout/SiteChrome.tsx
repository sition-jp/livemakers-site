"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { useChromeData } from "@/components/layout/useChromeData";
import { TickerBar } from "@/components/terminal/TickerBar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
 *
 * 2026-11-20 (Vercel ISR Writes 削減): ticker と来歴帯の中身はブラウザが
 * /api/chrome から読む (useChromeData)。全ページの HTML に市場データを焼くと、
 * 市場データが新しくなる (cron の合図・1 日 6 回) たびに全ページの中身が変わり、
 * 作り直しのたびに書き込み料金が掛かっていた。読めるまでは高さだけ確保した
 * 空の帯を出す (読み込み後に本文の位置が動かない)。テーマ切替は待たずに使える。
 */
export function SiteChrome({
  children,
  futureAtlasNav,
}: {
  children: React.ReactNode;
  futureAtlasNav: boolean;
}) {
  const pathname = usePathname();
  const chrome = useChromeData();
  // "home.provenance" まで絞る — client に渡す辞書は chrome scope だけ
  // (lib/i18n/client-messages.ts)
  const provenance = useTranslations("home.provenance");
  const nav = useTranslations("nav");

  if (isHiddenPreviewPath(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header futureAtlasNav={futureAtlasNav} />
      {chrome ? (
        <>
          <TickerBar items={chrome.tickerItems} />
          <GlobalProvenanceStrip
            provenance={chrome.pageProvenance}
            labels={{
              review: provenance("review"),
              source: provenance("source"),
              asOf: provenance("asOf"),
              packet: provenance("packet"),
            }}
            note={provenance("note")}
            chromeMeta={chrome.chromeMeta}
            snapshotLabel={nav("snapshot")}
          />
        </>
      ) : (
        <ChromePending />
      )}
      <main>{children}</main>
      <Footer futureAtlasNav={futureAtlasNav} />
    </>
  );
}

/** ticker と来歴帯を読み込む前の帯 (TickerBar・GlobalProvenanceStrip と同じ高さ)。 */
function ChromePending() {
  return (
    <div data-chrome="pending" aria-busy="true">
      <div className="border-y border-border-primary bg-bg-secondary">
        <div className="mx-auto flex max-w-[1920px] items-center px-6 py-3 text-xs tracking-label">
          <span className="invisible shrink-0 border px-1.5 py-0.5 font-mono text-[9px]">&nbsp;</span>
        </div>
      </div>
      <div className="border-b border-border-primary bg-bg-secondary text-[10.5px] text-text-tertiary">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
          <span className="invisible">&nbsp;</span>
          <span className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
          </span>
        </div>
      </div>
    </div>
  );
}
