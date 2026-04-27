import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TerminalAsset } from "@/lib/terminal/asset-summary";
import { AssetDetailFeed } from "@/components/terminal/asset/AssetDetailFeed";

/**
 * /assets/{btc|eth|ada|night} — asset detail page.
 *
 * Server wrapper sets locale + i18n context, validates asset URL param,
 * and hands off to the AssetDetailFeed client component (SWR fetch from
 * /api/assets/{asset}/summary every 60s).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md
 */
export default async function AssetPage({
  params,
}: {
  params: Promise<{ locale: string; asset: string }>;
}) {
  const { locale, asset: rawAsset } = await params;
  setRequestLocale(locale);

  const upper = rawAsset.toUpperCase();
  const parsed = TerminalAsset.safeParse(upper);
  if (!parsed.success) {
    notFound();
  }

  const t = await getTranslations("assets");

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-6">
        <Link
          href="/"
          className="text-xs uppercase tracking-label text-text-tertiary hover:text-text-primary"
        >
          {t("back_to_overview")}
        </Link>
      </div>
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-light tracking-title">
          {t("page_title", { asset: parsed.data })}
        </h1>
        <p className="text-text-secondary">{t("page_subtitle")}</p>
      </header>
      <AssetDetailFeed asset={parsed.data} />
    </section>
  );
}
