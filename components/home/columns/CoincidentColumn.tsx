import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import type { HomeCompositionProps } from "../HomeComposition";
import { IndicatorTileCard } from "../IndicatorTileCard";
import { LaneValuesCard } from "../LaneValuesCard";
import { LeadArticleCard } from "../LeadArticleCard";
import { SignalTimeline } from "../SignalTimeline";
import { TopMoversCard } from "../TopMoversCard";

const REGION = "coincident" satisfies GradientRegion;

/**
 * 中央カラム = 一致 (G44 D6 / 2026-08-14 Phase 3 改訂)。モジュール順は勾配台帳
 * REGION_MODULES.coincident。lead-article は D8 の単一表現ルールで desktop 専用
 * (mobile は CompositeHero が担う)。mkt12-reading = 「今朝の12指標」最新 1 本 +
 * シリーズページへのアーカイブリンク (lead-article 直下)。
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
        // 2026-08-14 Phase 3 (田平氏 GO): 最新の「今朝の12指標」1 本だけを
        // Daily Intel 直下に置く。週末カードとアーカイブ行は撤去し (週末は
        // 遅行カラムの索引カードが担う)、シリーズページへの 1 行リンクに集約。
        return (
          <section
            data-mkt12-reading
            className="flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-4"
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
            <div data-mkt12-role="archive-link" data-index-nav className="mt-3">
              <Link
                href="/articles/series/mkt12-morning"
                className="text-xs font-bold text-accent"
              >
                {copy.mkt12.archiveLink}
              </Link>
            </div>
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
