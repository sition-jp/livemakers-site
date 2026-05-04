import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { readAssetsSnapshot } from "@/lib/pivots/pivots-reader";
import { RadarTable } from "@/components/turning-points/RadarTable";
import { DisclaimerBanner } from "@/components/turning-points/DisclaimerBanner";
import { UnavailableNotice } from "@/components/turning-points/UnavailableNotice";

/**
 * /turning-points — Market Timing Radar (PRD §22 Screen 1).
 *
 * Phase 1: server-renders directly from the materialised mock JSON.
 * Phase 2: same shape, fed by the SDE producer; no consumer changes needed.
 *
 * Three reader states surfaced separately (Codex P2.3):
 *   1. parseError !== null   → UnavailableNotice (snapshot malformed)
 *   2. snapshot present      → RadarTable with assets
 *   3. snapshot null + no err → RadarTable empty state (pre-launch)
 */
export default async function TurningPointsRadarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("turningPoints");
  const tBacktest = await getTranslations("turningPoints.backtest");
  const result = await readAssetsSnapshot();

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-light tracking-title text-text-primary">
          {t("page_title")}
        </h1>
        <p className="text-text-secondary">{t("page_subtitle")}</p>
        <p className="text-xs text-text-tertiary max-w-2xl leading-relaxed">
          {t("research_note")}
        </p>
      </header>

      <DisclaimerBanner />

      <section aria-labelledby="radar-heading" className="space-y-4">
        <h2
          id="radar-heading"
          className="text-sm uppercase tracking-label text-text-secondary"
        >
          {t("radar.heading")}
        </h2>
        {result.parseError !== null ? (
          <UnavailableNotice
            reason={result.parseError}
            testid="radar-unavailable"
          />
        ) : (
          <RadarTable assets={result.snapshot?.radar ?? []} />
        )}
      </section>

      <nav className="text-sm">
        <Link
          href="/turning-points/backtest"
          className="text-pillar-market hover:underline"
        >
          {tBacktest("heading")} →
        </Link>
      </nav>
    </section>
  );
}
