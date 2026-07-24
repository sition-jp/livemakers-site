"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
// usePathname comes from next/navigation here (not next-intl/navigation)
// because switchLocale needs the RAW pathname including the /ja prefix to
// strip-and-prepend correctly. next-intl's usePathname strips the locale.
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/LogoMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LogoColorBand } from "@/components/layout/LogoColorBand";
import { buildNavModel } from "@/lib/home/nav-model";
import type { SnapshotChromeMeta } from "@/lib/home/market-snapshot";

export function Header({
  chromeMeta,
  futureAtlasNav,
}: {
  chromeMeta: SnapshotChromeMeta;
  futureAtlasNav: boolean;
}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const nav = buildNavModel(futureAtlasNav);
  const [articlesOpen, setArticlesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function switchLocale(target: "en" | "ja") {
    if (target === locale) return;
    // Set cookie BEFORE navigating so the new request reaches next-intl's
    // middleware with the right preference. Use a hard navigation
    // (window.location.assign) — router.push from next/navigation is a no-op
    // on locale switches because the [locale] route segment resolves "/" to
    // the current locale's URL, leaving us on /ja. A hard navigation forces
    // the middleware to re-evaluate cookies and serve the new locale.
    document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const stripped = pathname.replace(/^\/(ja|en)(\/|$)/, "/");
    const nextPath = target === "en" ? stripped : `/ja${stripped === "/" ? "" : stripped}`;
    window.location.assign(nextPath);
  }

  const topLevelClass =
    "text-xs tracking-tabs text-text-secondary hover:text-text-primary";

  return (
    <header className="sticky top-0 z-50 border-b border-border-primary bg-bg-primary/95 backdrop-blur">
      <LogoColorBand />
      {/* 390px ではブランド行と操作行の 2 段に折り返して横スクロールを出さない
          （言語切替・SNAPSHOT チップは常時表示要件のため非表示にしない・T16 pinpoint） */}
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          aria-label="LIVEMAKERS"
          className="flex items-center gap-2.5 text-text-primary"
        >
          <LogoMark className="h-7 w-7 shrink-0 text-text-primary" />
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-logo">LIVEMAKERS</span>
            {/* Hidden below sm so the brand row and the theme toggle both fit
                a 390px viewport (G39-A1 review fix). */}
            <span className="hidden rounded border border-border-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-label text-text-secondary sm:inline-block">
              {t("alpha")}
            </span>
          </span>
        </Link>

        {/* Desktop grouped nav (G44 D3): logo(=overview) / 記事▾ / [未来アトラス] /
            Session Terminal / About. dropdown = button + aria-expanded. */}
        <nav className="hidden items-center gap-4 lg:flex" aria-label="primary">
          <div className="relative">
            <button
              type="button"
              aria-expanded={articlesOpen}
              aria-haspopup="menu"
              aria-controls="articles-menu"
              onClick={() => setArticlesOpen((open) => !open)}
              className={`${topLevelClass} inline-flex items-center gap-1`}
            >
              {t("articlesGroup")}
              <span aria-hidden="true">▾</span>
            </button>
            {articlesOpen ? (
              <div
                id="articles-menu"
                role="menu"
                className="absolute left-0 top-full z-50 mt-2 min-w-44 rounded-md border border-border-primary bg-bg-primary p-1 shadow-lg"
              >
                {nav.articlesGroup.map((item) => (
                  <Link
                    key={item.key}
                    role="menuitem"
                    href={item.href}
                    onClick={() => setArticlesOpen(false)}
                    className="block rounded px-3 py-1.5 text-xs tracking-tabs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  >
                    {t(item.key)}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {nav.topLevel.map((item) => (
            <Link key={item.key} href={item.href} className={topLevelClass}>
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <span className="hidden font-mono text-[10px] text-text-tertiary xl:inline">
            {chromeMeta.dateLabel}
          </span>
          <span className="max-w-[73px] overflow-hidden whitespace-nowrap rounded bg-bg-tertiary px-2 py-1 font-mono text-[9px] font-bold tracking-label text-text-secondary sm:max-w-none">
            {t("snapshot")} {chromeMeta.asOfLabel}
          </span>
          <span
            className="hidden text-[10px] tracking-label text-text-tertiary xl:inline"
            title={`build ${process.env.NEXT_PUBLIC_BUILD_SHA} · ${process.env.NEXT_PUBLIC_BUILD_DATE}`}
          >
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] tracking-label">
            <button
              type="button"
              onClick={() => switchLocale("en")}
              className={
                locale === "en"
                  ? "text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }
            >
              EN
            </button>
            <span className="text-text-tertiary">/</span>
            <button
              type="button"
              onClick={() => switchLocale("ja")}
              className={
                locale === "ja"
                  ? "text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }
            >
              日本語
            </button>
          </div>
          {/* Mobile disclosure (lg 未満・現行はモバイル導線ゼロのため新設・G44 D3) */}
          <button
            type="button"
            className="text-text-secondary hover:text-text-primary lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={t("menu")}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-menu"
          className="border-t border-border-primary px-4 py-3 lg:hidden"
        >
          <p className="mb-1 text-[10px] font-bold tracking-label text-text-tertiary">
            {t("articlesGroup")}
          </p>
          <div className="flex flex-col">
            {nav.articlesGroup.map((item) => (
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
          <div className="mt-2 flex flex-col border-t border-border-primary pt-2">
            {nav.topLevel.map((item) => (
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
