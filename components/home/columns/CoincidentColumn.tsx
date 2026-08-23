import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import type { HomeCompositionProps } from "../HomeComposition";
import { ArticleRow } from "../ArticleRow";
import { IndicatorTileCard } from "../IndicatorTileCard";
import { LaneValuesCard } from "../LaneValuesCard";
import { LeadArticleCard } from "../LeadArticleCard";
import { SignalTimeline } from "../SignalTimeline";
import { TopMoversCard } from "../TopMoversCard";

const REGION = "coincident" satisfies GradientRegion;

/**
 * 中央カラム = 一致 (G44 D6 / 2026-08-14 Phase 3 改訂 / 2026-08-23 GO B-1)。
 * モジュール順は勾配台帳 REGION_MODULES.coincident。morning-desk = 「Daily Intel」帯
 * (ヘッダ「Daily Intel」+ 一覧リンク / compact Daily Intel = D8 で desktop 専用・
 * mobile は CompositeHero が担う / サムネなし 12指標行 + 行右隣にアーカイブリンク)。
 * 直下に signal-timeline (Signal 前面化)。
 */
export type CoincidentColumnProps = Pick<
  HomeCompositionProps,
  | "slots"
  | "snapshot"
  | "coreCells"
  | "laneCells"
  | "laneProvenance"
  | "mkt12Provenance"
  | "copy"
>;

// Daily Intel の <xl hidden は morning-desk 帯の内部 (data-morning-desk-role) へ移った
const MODULE_CLASSNAMES: Readonly<Record<string, string>> = {};

export function CoincidentColumn({
  slots,
  snapshot,
  coreCells,
  laneCells,
  laneProvenance,
  mkt12Provenance,
  copy,
}: CoincidentColumnProps) {
  const familyLabels = copy.familyLabels;

  const renderModule = (module: string): ReactNode => {
    switch (module) {
      case "morning-desk": {
        // 2026-08-23 田平氏 GO B-1: lead-article + mkt12-reading を 1 帯に統合。
        // ヘッダ文言は familyLabels["daily-intel"] (「Daily Intel」・田平氏裁定)。
        // 2026-08-15 GO 継承: 土曜は variant="weekend" (文言・アーカイブ先を週末系へ)。
        const isWeekend = slots.mkt12.variant === "weekend";
        const mkt12Text = isWeekend
          ? {
              awaiting: copy.mkt12.awaitingWeekend,
              previous: copy.mkt12.previousWeekend,
              archiveHref: "/articles/series/mkt12-weekend",
            }
          : {
              awaiting: copy.mkt12.awaiting,
              previous: copy.mkt12.previous,
              archiveHref: "/articles/series/mkt12-morning",
            };
        return (
          <section
            data-morning-desk
            className="flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-bold text-text-primary">
                {familyLabels["daily-intel"]}
              </h3>
              <div data-index-nav className="shrink-0">
                <Link
                  href="/articles/series/daily-intel"
                  className="whitespace-nowrap text-xs font-bold text-accent"
                >
                  {copy.gradient.dailyIntelSeriesLink}
                </Link>
              </div>
            </div>
            {/* D8: Daily Intel の単一表現 — <xl は CompositeHero が見出しを担う */}
            <div
              data-morning-desk-role="daily-intel"
              className="mt-3 hidden xl:block"
            >
              <LeadArticleCard
                slot={slots.lead}
                labels={copy.lead}
                variant="compact"
              />
            </div>
            <div
              data-mkt12-reading
              data-mkt12-variant={slots.mkt12.variant}
              className="mt-3 flex items-start justify-between gap-3 border-t border-border-primary"
            >
              <div data-mkt12-role="hero" className="min-w-0 flex-1">
                {slots.mkt12.article ? (
                  <ArticleRow
                    article={slots.mkt12.article}
                    familyLabel={familyLabels[slots.mkt12.article.family]}
                  />
                ) : (
                  <div className="mt-2 rounded bg-bg-tertiary p-3 text-xs text-text-secondary">
                    <p>{mkt12Text.awaiting}</p>
                    {slots.mkt12.previous ? (
                      <div data-index-nav className="mt-2">
                        <Link
                          href={slots.mkt12.previous.href}
                          className="font-bold text-accent"
                        >
                          {mkt12Text.previous}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div
                data-mkt12-role="archive-link"
                data-index-nav
                className="shrink-0 pt-2.5"
              >
                <Link
                  href={mkt12Text.archiveHref}
                  className="whitespace-nowrap text-xs font-bold text-accent"
                >
                  {copy.mkt12.archiveLink}
                </Link>
              </div>
            </div>
          </section>
        );
      }
      case "mkt12-tiles":
        return (
          <div className="space-y-3">
            <IndicatorTileCard
              cells={coreCells}
              dataDate={snapshot.dataDate}
              asOfLabel={snapshot.asOfLabel}
              regimeNoteJa={slots.mkt12.article?.regimeNoteJa}
              provenance={mkt12Provenance}
              copy={copy.mkt12.indicator}
            />
            <TopMoversCard
              cells={coreCells}
              provenance={mkt12Provenance}
              copy={copy.mkt12.movers}
            />
          </div>
        );
      case "signal-timeline":
        return (
          <SignalTimeline
            articles={slots.signalTimeline}
            copy={{
              title: copy.gradient.signalTitle,
              familyLabels: copy.familyLabels,
              seriesLink: copy.gradient.signalSeriesLink,
              freshness: copy.gradient.signalFreshness,
            }}
          />
        );
      case "lane-values":
        return (
          <LaneValuesCard
            laneCells={laneCells}
            laneProvenance={laneProvenance}
            copy={{
              title: copy.gradient.laneValuesTitle,
              laneLabels: copy.lanes.titles,
              provenance: copy.provenance,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section data-ledger-group={REGION} className="min-w-0 space-y-6">
      {REGION_MODULES[REGION].map((module) => (
        <div
          key={module}
          data-column-module={module}
          className={MODULE_CLASSNAMES[module]}
        >
          {renderModule(module)}
        </div>
      ))}
    </section>
  );
}
