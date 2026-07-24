import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import type { HomeCompositionProps } from "../HomeComposition";
import { ArticleCardSmall } from "../ArticleCardSmall";
import { ArticleRow } from "../ArticleRow";
import { IndicatorTileCard } from "../IndicatorTileCard";
import { LaneValuesCard } from "../LaneValuesCard";
import { LeadArticleCard } from "../LeadArticleCard";
import { SignalTimeline } from "../SignalTimeline";
import { TopMoversCard } from "../TopMoversCard";

const REGION = "coincident" satisfies GradientRegion;

/**
 * 中央カラム = 一致 (G44 D6)。モジュール順は勾配台帳 REGION_MODULES.coincident。
 * lead-article は D8 の単一表現ルールで desktop 専用 (mobile は CompositeHero が担う)。
 * mkt12-reading は旧構成の data-mkt12-reading 節 (hero → periods-divider →
 * weekend → archive) をそのまま継承する。signal-timeline / lane-values は
 * T9 が SignalTimeline / LaneValuesCard を実装するまで空プレースホルダ。
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

const MODULE_CLASSNAMES: Readonly<Record<string, string>> = {
  "lead-article": "hidden xl:block",
};

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
      case "lead-article":
        return <LeadArticleCard slot={slots.lead} labels={copy.lead} />;
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
      case "mkt12-reading":
        return (
          <section
            data-mkt12-reading
            className="flex h-full flex-col rounded-lg border border-border-primary bg-bg-secondary p-4"
          >
            <h3 className="text-sm font-bold text-text-primary">
              {copy.mkt12.articleTitle}
            </h3>
            <div data-mkt12-role="hero" className="mt-3">
              {slots.mkt12.article ? (
                <LeadArticleCard
                  slot={{
                    state: "today",
                    article: slots.mkt12.article,
                    previous: null,
                  }}
                  labels={{
                    ...copy.lead,
                    family: familyLabels[slots.mkt12.article.family],
                  }}
                  headingLevel="h4"
                />
              ) : (
                <div className="rounded bg-bg-tertiary p-3 text-xs text-text-secondary">
                  <p>{copy.mkt12.awaiting}</p>
                  {slots.mkt12.previous ? (
                    <div data-index-nav className="mt-2">
                      <Link
                        href={slots.mkt12.previous.href}
                        className="font-bold text-accent"
                      >
                        {copy.mkt12.previous}
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div
              data-mkt12-role="periods-divider"
              className="my-4 flex items-center gap-3 text-[10px] font-bold tracking-label text-text-tertiary"
            >
              <span className="h-px flex-1 bg-border-primary" />
              <span>{copy.mkt12.otherPeriods}</span>
              <span className="h-px flex-1 bg-border-primary" />
            </div>
            <div data-mkt12-role="weekend">
              {slots.mkt12.weekend ? (
                <ArticleCardSmall
                  article={slots.mkt12.weekend}
                  familyLabel={familyLabels[slots.mkt12.weekend.family]}
                />
              ) : null}
            </div>
            <section
              data-mkt12-role="archive"
              className="mt-4 flex-1 rounded border border-border-primary"
            >
              <header className="border-b border-border-primary px-3 py-2.5">
                <h4 className="text-xs font-bold text-text-primary">
                  {copy.mkt12.archiveTitle}
                </h4>
                <p className="mt-0.5 text-[10px] text-text-tertiary">
                  {copy.mkt12.archiveSubtitle}
                </p>
              </header>
              <div>
                {slots.mkt12.archive.map((article) => (
                  <ArticleRow
                    key={article.articleId}
                    article={article}
                    familyLabel={familyLabels[article.family]}
                  />
                ))}
              </div>
            </section>
          </section>
        );
      case "signal-timeline":
        return (
          <SignalTimeline
            articles={slots.signalTimeline}
            copy={{
              title: copy.gradient.signalTitle,
              familyLabels: copy.familyLabels,
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
