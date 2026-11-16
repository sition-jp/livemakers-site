import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { readAssetsSnapshot } from "@/lib/pivots/pivots-reader";
import { RadarTable } from "@/components/turning-points/RadarTable";
import { DisclaimerBanner } from "@/components/turning-points/DisclaimerBanner";
import { UnavailableNotice } from "@/components/turning-points/UnavailableNotice";
import { Freshness } from "@/components/turning-points/Freshness";
import { ReadingGuide } from "@/components/turning-points/ReadingGuide";
import { ProbabilityTimeline } from "@/components/turning-points/ProbabilityTimeline";
import { allForecastScreen, allV2Screen } from "@/lib/pivots/forecast-screen";
import { chipParts, flipNoteParts, overviewParts, type LayerId } from "@/lib/pivots/regime";
import { legendItems } from "@/lib/pivots/range-band";
import { pickForecast } from "@/lib/pivots/forecast";
import { TimelineMini } from "@/components/turning-points/TimelineMini";
import { localeAlternates } from "@/lib/seo/locale-alternates";

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
const LIST_LAYERS: readonly LayerId[] = ["long", "mid", "near"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "turningPoints" });
  return {
    title: t("page_title"),
    description: t("page_subtitle"),
    alternates: localeAlternates(locale, "/turning-points"),
  };
}

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
  const snapshot = result.parseError === null ? result.snapshot : null;
  const useForecast = allForecastScreen(snapshot);
  // v2: 全資産に regime と range_band があるときだけ (混在させない)
  const useV2 = useForecast && allV2Screen(snapshot);
  const tv2 = await getTranslations("turningPoints.v2");
  const todayIso = (snapshot?.generated_at ?? new Date().toISOString()).slice(0, 10);

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-light tracking-title text-text-primary">
          {t("page_title")}
        </h1>
        <p className="text-text-secondary">{t(useV2 ? "page_subtitle_v2" : "page_subtitle")}</p>
        <p className="text-xs text-text-tertiary max-w-2xl leading-relaxed">
          {t("research_note")}
        </p>
      </header>

      <Freshness generatedAt={result.snapshot?.generated_at ?? null} />

      <ReadingGuide variant={useForecast ? "forecast" : "radar"} />

      <DisclaimerBanner />

      {useV2 && snapshot ? (
        <section data-testid="list-overview" aria-labelledby="overview-heading" className="space-y-6">
          <h2 id="overview-heading" className="text-sm uppercase tracking-label text-text-secondary">
            {t("overview_heading")}
          </h2>
          <p className="text-lg text-text-primary">
            {overviewParts(snapshot.regime ?? {})
              .map((p) => tv2(p.key, p.values))
              .join("")}
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {snapshot.radar.map((a) => {
              const regime = snapshot.regime?.[a.symbol];
              const band = snapshot.range_band?.[a.symbol];
              const chips = regime ? chipParts(regime) : null;
              // 予告は「変わる」の 1 文だけ (週足で決めている旨は詳細ページに)
              const flip = regime ? flipNoteParts(a.symbol, regime)?.[1] : undefined;
              const b7 = band ? legendItems(band).find((l) => l.id === "b7") : undefined;
              return (
                <li
                  key={a.symbol}
                  data-testid={`list-asset-${a.symbol}`}
                  className="space-y-2 rounded-sm border border-border-primary p-4"
                >
                  <h3 className="text-sm uppercase tracking-label text-text-secondary">
                    <Link href={`/turning-points/${a.symbol.toLowerCase()}`} className="hover:underline">
                      {a.symbol}
                    </Link>
                  </h3>
                  {chips ? (
                    <dl className="divide-y divide-border-primary/60">
                      {LIST_LAYERS.filter((l) => chips[l]).map((l) => {
                        const c = chips[l]!;
                        return (
                          <div
                            key={l}
                            data-testid={`list-chip-${a.symbol}-${l}`}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5"
                          >
                            <dt className="text-xs text-text-tertiary">{tv2(c.label.key, c.label.values)}</dt>
                            <dd className="text-right">
                              <span className="font-bold text-text-primary">{tv2(c.value.key, c.value.values)}</span>
                              {l === "mid" ? (
                                <span className="block text-xs text-text-secondary">{tv2(c.note.key, c.note.values)}</span>
                              ) : null}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  ) : null}
                  {flip ? (
                    <p
                      data-testid={`list-flip-${a.symbol}`}
                      className="border-l-4 border-pillar-market bg-bg-secondary px-3 py-2 text-sm text-text-primary"
                    >
                      {tv2(flip.key, flip.values)}
                    </p>
                  ) : null}
                  {b7 ? (
                    <p data-testid={`list-oneline-${a.symbol}`} className="text-sm text-text-secondary">
                      {tv2("band.oneLine", { lo: b7.lo, hi: b7.hi, tenN: b7.tenN, usualPct: b7.usualPct })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
          <RadarTable
            assets={result.snapshot?.radar ?? []}
            previous={result.snapshot?.previous ?? null}
            forecast={useForecast ? snapshot?.forecast : undefined}
            v2={useV2}
          />
        )}
      </section>

      {snapshot && snapshot.radar.length > 0 ? (
        <section aria-labelledby="timeline-mini-heading" className="space-y-4">
          <h2
            id="timeline-mini-heading"
            className="text-sm uppercase tracking-label text-text-secondary"
          >
            {t("timeline.heading")}
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            {snapshot.radar.map((asset) => (
              useForecast ? (
                <ProbabilityTimeline
                  key={asset.symbol}
                  asset={asset.symbol}
                  history={snapshot.forecast_history?.[asset.symbol] ?? []}
                  turns={snapshot.turns?.[asset.symbol]}
                  item={pickForecast(snapshot.forecast?.[asset.symbol], "turn", "30D")}
                  variant="mini"
                />
              ) : (
                <TimelineMini
                  key={asset.symbol}
                  asset={asset.symbol}
                  today={todayIso}
                  history={snapshot.history?.[asset.symbol] ?? null}
                />
              )
            ))}
          </div>
        </section>
      ) : null}

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
