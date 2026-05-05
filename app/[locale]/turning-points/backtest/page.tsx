import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { readBacktestSnapshot } from "@/lib/pivots/pivots-reader";
import { BacktestPanel } from "@/components/turning-points/BacktestPanel";
import { DisclaimerBanner } from "@/components/turning-points/DisclaimerBanner";
import { UnavailableNotice } from "@/components/turning-points/UnavailableNotice";
import { Freshness } from "@/components/turning-points/Freshness";
import { ProvisionalBacktestBanner } from "@/components/turning-points/ProvisionalBacktestBanner";

/**
 * /turning-points/backtest — Backtest screen (PRD §22 Screen 3).
 *
 * Phase 1 displays all entries flat. Phase 2 will add asset / horizon /
 * score-type / threshold filters once the producer materialises a wider
 * grid.
 */
export default async function BacktestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("turningPoints");
  const result = await readBacktestSnapshot();

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 space-y-8">
      <div>
        <Link
          href="/turning-points"
          className="text-xs uppercase tracking-label text-text-tertiary hover:text-text-primary"
        >
          {t("detail.back")}
        </Link>
      </div>
      <header className="space-y-2">
        <h1 className="text-4xl font-light tracking-title text-text-primary">
          {t("backtest.heading")}
        </h1>
        <p className="text-text-secondary max-w-2xl">
          {t("backtest.subheading")}
        </p>
      </header>

      <Freshness generatedAt={result.snapshot?.generated_at ?? null} />
      <ProvisionalBacktestBanner />

      <DisclaimerBanner />

      {result.parseError !== null ? (
        <UnavailableNotice
          reason={result.parseError}
          testid="backtest-unavailable"
        />
      ) : (
        <BacktestPanel entries={result.snapshot?.entries ?? []} />
      )}
    </section>
  );
}
