import { setRequestLocale } from "next-intl/server";

import { LedgerSummaryBand } from "@/components/future-atlas/LedgerSummaryBand";
import { getForecastSnapshotStates, LedgerTable } from "@/components/future-atlas/LedgerTable";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { buildLedgerSummary, currentJstDate } from "@/lib/future-atlas/snapshot";

export const revalidate = 300;

export default async function FutureAtlasLedgerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await loadFutureAtlas();
  const evaluationDateJst = currentJstDate();
  const summary = buildLedgerSummary(getForecastSnapshotStates(data), evaluationDateJst);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <p className="font-mono text-[10px] font-bold uppercase tracking-label text-text-tertiary">Future Atlas</p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">未来予測台帳</h1>
      </header>
      <div className="mt-8"><LedgerSummaryBand summary={summary} /></div>
      <div className="mt-8"><LedgerTable data={data} evaluationDateJst={evaluationDateJst} /></div>
    </main>
  );
}
