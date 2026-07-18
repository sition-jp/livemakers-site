import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LedgerSummaryBand } from "@/components/future-atlas/LedgerSummaryBand";
import { getForecastSnapshotStates } from "@/components/future-atlas/LedgerTable";
import { ThemeShelves } from "@/components/future-atlas/ThemeShelves";
import { Link } from "@/i18n/navigation";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { buildLedgerSummary, currentJstDate } from "@/lib/future-atlas/snapshot";

export const revalidate = 300;

export default async function FutureAtlasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await loadFutureAtlas();
  if (!data.config.surfacePublished) notFound();
  const language = locale === "en" ? "en" : "ja";
  const t = await getTranslations({ locale, namespace: "futureAtlas.surface" });

  const summary = buildLedgerSummary(getForecastSnapshotStates(data), currentJstDate());

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] font-bold uppercase tracking-label text-text-tertiary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-base leading-relaxed text-text-secondary">{t("definition")}</p>
        <Link href="/future-atlas/methodology" className="mt-4 inline-block text-sm font-medium text-text-primary underline underline-offset-4">{t("methodologyLink")}</Link>
      </header>
      <div className="mt-8"><LedgerSummaryBand summary={summary} /></div>
      <div className="mt-10"><ThemeShelves data={data} locale={language} /></div>
    </main>
  );
}
