"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
// usePathname comes from next/navigation here (not next-intl/navigation)
// because switchLocale needs the RAW pathname including the /ja prefix to
// strip-and-prepend correctly. next-intl's usePathname strips the locale.
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/LogoMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LogoColorBand } from "@/components/layout/LogoColorBand";
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

        <nav className="hidden items-center gap-4 lg:flex">
          <Link
            href="/"
            className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
          >
            {t("overview")}
          </Link>
          <Link
            href="/brief"
            className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
          >
            {t("brief")}
          </Link>
          <Link
            href="/articles/today"
            className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
          >
            {t("articles")}
          </Link>
          <Link
            href="/sessions/archive"
            className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
          >
            {t("archive")}
          </Link>
          {futureAtlasNav && (
            <Link
              href="/future-atlas"
              className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
            >
              {t("futureAtlas")}
            </Link>
          )}
          {/* SIGNALS / SUBSCRIBE are temporarily hidden from nav while still
              in development. The pages themselves remain reachable via URL
              (livemakers.com/signals, /subscribe). Restore these <Link>
              elements when both features ship for general availability. */}
          <Link
            href="/about"
            className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
          >
            {t("about")}
          </Link>
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
        </div>
      </div>
    </header>
  );
}
