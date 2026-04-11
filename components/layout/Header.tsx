"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
// usePathname comes from next/navigation here (not next-intl/navigation)
// because switchLocale needs the RAW pathname including the /ja prefix to
// strip-and-prepend correctly. next-intl's usePathname strips the locale.
import { usePathname } from "next/navigation";
import { LogoSvg } from "@/components/ui/LogoSvg";

export function Header() {
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
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-text-primary">
          <LogoSvg className="h-7 w-7 text-pillar-overview" />
          <span className="text-sm font-bold tracking-logo">LIVEMAKERS</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
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
            href="/subscribe"
            className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
          >
            {t("subscribe")}
          </Link>
          <Link
            href="/about"
            className="text-xs tracking-tabs text-text-secondary hover:text-text-primary"
          >
            {t("about")}
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-[10px] tracking-label text-text-tertiary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-status-live" />
            {t("live")}
          </span>
          <div className="flex items-center gap-1 text-[10px] tracking-label">
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
