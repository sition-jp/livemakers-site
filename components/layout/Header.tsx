"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/LogoMark";
import { LogoColorBand } from "@/components/layout/LogoColorBand";
import { buildFlatNav } from "@/lib/home/nav-model";

/**
 * ヘッダ 1 段目 (2026-08-14 田平氏指示で再構成):
 * logo + フラット 1 列ナビ (dropdown なし・左揃え)。旧右側クラスタ
 * (LIGHT/DARK・日付・SNAPSHOT チップ・version) は 3 段目
 * (GlobalProvenanceStrip) へ移設。ナビ順の正本 = buildFlatNav。
 */
export function Header({ futureAtlasNav }: { futureAtlasNav: boolean }) {
  const t = useTranslations("nav");
  const nav = buildFlatNav(futureAtlasNav);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border-primary bg-bg-primary/95 backdrop-blur">
      <LogoColorBand />
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          aria-label="LIVEMAKERS"
          className="flex items-center gap-2.5 text-text-primary"
        >
          <LogoMark className="h-7 w-7 shrink-0 text-text-primary" />
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-logo">LIVEMAKERS</span>
            <span className="hidden rounded border border-border-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-label text-text-secondary sm:inline-block">
              {t("alpha")}
            </span>
          </span>
        </Link>

        {/* フラット 1 列ナビ (lg 以上・左揃え) */}
        <nav
          className="hidden flex-wrap items-center gap-x-4 gap-y-1 lg:flex"
          aria-label="primary"
        >
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* Mobile disclosure (lg 未満) — 同一順のフラットリスト */}
        <button
          type="button"
          className="ml-auto text-text-secondary hover:text-text-primary lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={t("menu")}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-menu"
          className="border-t border-border-primary px-4 py-3 lg:hidden"
        >
          <div className="flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="py-1.5 text-sm tracking-tabs text-text-secondary hover:text-text-primary"
              >
                {t(item.key)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
