import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LedgerSummaryBand } from "@/components/future-atlas/LedgerSummaryBand";
import { getForecastSnapshotStates, LedgerTable } from "@/components/future-atlas/LedgerTable";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { buildLedgerSummary, currentJstDate } from "@/lib/future-atlas/snapshot";
import { localeAlternates } from "@/lib/seo/locale-alternates";

export const revalidate = 21600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "futureAtlas.ledger" });
  return {
    title: t("title"),
    alternates: localeAlternates(locale, "/future-atlas/ledger"),
  };
}

export default async function FutureAtlasLedgerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await loadFutureAtlas();
  const language = locale === "en" ? "en" : "ja";
  const t = await getTranslations({ locale, namespace: "futureAtlas.ledger" });
  const evaluationDateJst = currentJstDate();
  const summary = buildLedgerSummary(getForecastSnapshotStates(data), evaluationDateJst);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-[10px] font-bold uppercase tracking-label text-text-tertiary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">{t("title")}</h1>
      </header>
      <div className="mt-8"><LedgerSummaryBand summary={summary} /></div>
      <div className="mt-8"><LedgerTable data={data} evaluationDateJst={evaluationDateJst} locale={language} /></div>
    </main>
  );
}
