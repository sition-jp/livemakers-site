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
import { mkt12ReadingText } from "../mkt12-reading-text";
import { SignalTimeline } from "../SignalTimeline";
import { TopMoversCard } from "../TopMoversCard";

const REGION = "coincident" satisfies GradientRegion;

/**
 * 中央カラム = 一致 (G44 D6 / 2026-08-14 Phase 3 改訂 / 2026-10-26 で 8/22 の形へ)。
 * モジュール順は勾配台帳 REGION_MODULES.coincident。lead-article と mkt12-reading は
 * D8 の単一表現ルールで desktop 専用 (mobile は左列のカードが担う・2026-10-26)。
 * mkt12-reading = 「今朝の12指標」最新 1 本 + シリーズページへのアーカイブリンク
 * (lead-article 直下)。
 * 直下に signal-timeline。
 */
export type CoincidentColumnProps = Pick<
  HomeCompositionProps,
  | "slots"
  | "snapshot"
  | "coreCells"
  | "laneCells"
  | "laneProvenance"
  | "alt20"
  | "mkt12Provenance"
  | "copy"
>;

// 2026-10-26 田平氏 GO: スマホでは Daily Intel と今朝の12指標を左列の Intelligence
// Terminal の下 (lead-card-mobile / mkt12-card-mobile) に出すので、この 2 欄は PC 専用。
const MODULE_CLASSNAMES: Readonly<Record<string, string>> = {
  "lead-article": "hidden xl:block",
  "mkt12-reading": "hidden xl:block",
};

export function CoincidentColumn({
  slots,
  snapshot,
  coreCells,
  laneCells,
  laneProvenance,
  alt20,
  mkt12Provenance,
  copy,
}: CoincidentColumnProps) {
  const familyLabels = copy.familyLabels;

  const renderModule = (module: string): ReactNode => {
    switch (module) {
      case "lead-article":
        // Phase 3b (2026-08-14): Daily Intel 一覧への索引リンクを同じ箱に収める。
        // 2026-10-26 田平氏 GO: 8/23 の「Daily Intel」帯をやめ、この 8/22 の形へ戻す。
        return (
          <section className="flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-4">
            <LeadArticleCard slot={slots.lead} labels={copy.lead} />
            <div data-index-nav className="mt-3">
              <Link
                href="/articles/series/daily-intel"
                className="text-xs font-bold text-accent"
              >
                {copy.gradient.dailyIntelSeriesLink}
              </Link>
            </div>
          </section>
        );
      case "mkt12-reading": {
        // 2026-08-14 Phase 3 (田平氏 GO): 最新の「今朝の12指標」1 本だけを
        // Daily Intel 直下に置き、シリーズページへの 1 行リンクに集約。
        // 2026-08-15 田平氏 GO: 土曜は朝版 writer が発火しないため、
        // variant="weekend" として週末版を同じ枠に出す (見出し・文言・
        // アーカイブ先も週末系へ)。遅行カラムの索引カードとの二重掲載は許容。
        // 2026-10-26 田平氏 GO: 8/23 の帯 (小サムネ行 + 右隣リンク) をやめ、
        // この 8/22 の欄へ戻す (右隣リンクはスマホ幅で行を押し縮めていた)。
        const mkt12Text = mkt12ReadingText(slots.mkt12.variant, copy.mkt12);
        return (
          <section
            data-mkt12-reading
            data-mkt12-variant={slots.mkt12.variant}
            className="flex flex-col rounded-lg border border-border-primary bg-bg-secondary p-4"
          >
            <h3 className="text-sm font-bold text-text-primary">
              {mkt12Text.title}
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
            <div data-mkt12-role="archive-link" data-index-nav className="mt-3">
              <Link
                href={mkt12Text.archiveHref}
                className="text-xs font-bold text-accent"
              >
                {copy.mkt12.archiveLink}
              </Link>
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
            alt20={alt20}
            copy={{
              title: copy.gradient.laneValuesTitle,
              laneLabels: copy.lanes.titles,
              provenance: copy.provenance,
              alt20: copy.lanes.alt20,
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
