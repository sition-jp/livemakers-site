import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardFeed } from "@/components/terminal/asset/DashboardFeed";
import { localeAlternates } from "@/lib/seo/locale-alternates";

/**
 * /assets — Terminal dashboard. 4-asset overview (BTC/ETH/ADA/NIGHT).
 *
 * Server wrapper sets locale + i18n context; the interactive DashboardFeed
 * client component fetches /api/dashboard via SWR and renders the 4 cards.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "assets.dashboard" });
  return {
    title: t("page_title"),
    description: t("page_subtitle"),
    alternates: localeAlternates(locale, "/assets"),
  };
}

export default async function AssetsDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("assets.dashboard");

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10">
        <h1 className="mb-2 text-4xl font-light tracking-title">
          {t("page_title")}
        </h1>
        <p className="text-text-secondary">{t("page_subtitle")}</p>
      </header>
      <DashboardFeed />
    </section>
  );
}
