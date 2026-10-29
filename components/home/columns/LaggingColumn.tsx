import type { ReactNode } from "react";

import { buildAtlasEntry } from "@/lib/home/atlas-entry";
import { type GradientRegion } from "@/lib/home/gradient-ledger";
import { orderLaggingModules } from "@/lib/home/lagging-order";
import { restartStageSummary } from "@/lib/restart-map/stages";
import type { HomeCompositionProps } from "../HomeComposition";
import { DeepDiveShelf } from "../DeepDiveShelf";
import { EventRiskModule } from "../EventRiskModule";
import { IndexEntryCard } from "../IndexEntryCard";
import { LatestArticlesCard } from "../LatestArticlesCard";

const REGION = "lagging" satisfies GradientRegion;

const MODULE_CLASSNAMES: Readonly<Record<string, string>> = {
  "event-risk-mobile": "xl:hidden",
};

/**
 * 右カラム = 遅行 (索引) (G44 D7)。モジュールの集合と末尾固定枠は勾配台帳
 * REGION_MODULES.lagging。**記事 5 枠 (Deep Dive / 未来アトラス / 週末の12指標 /
 * Weekly Brief / 金融再起動の現在地) は各枠の最新記事の公開順に動的に並ぶ**
 * (2026-08-23 田平氏 GO A・`orderLaggingModules`・restart-map は 2026-10-29 追加)。Event Risk (スマホ専用の写し・2026-10-26) ⑤ 最新記事
 * ⑥ Turning Point 予約席 (非表示) は末尾固定。
 * 台帳順の説明: ① Deep Dive (featured + title 4) ② 未来アトラス入口 (flag-aware)
 * ③ 週末の12指標 ④ Weekly Brief (latest null なら記事ブロック末尾)。②〜④ は
 * IndexEntryCard 共用 (最新 1 本は DeepDive featured と同じサムネ付きカード・
 * 2026-08-23)・⑤ と DeepDive の title 行は data-index-nav。
 */
export type LaggingColumnProps = Pick<
  HomeCompositionProps,
  "slots" | "surfacePublished" | "copy"
>;

export function LaggingColumn({
  slots,
  surfacePublished,
  copy,
}: LaggingColumnProps) {
  const atlas = buildAtlasEntry(surfacePublished, slots.atlasLatest);
  const indexCopy = { familyLabels: copy.familyLabels };
  const modules = orderLaggingModules(slots);

  const renderModule = (module: string): ReactNode => {
    switch (module) {
      case "deep-dive":
        return (
          <DeepDiveShelf
            articles={slots.deepDives}
            copy={{
              title: copy.gradient.deepDiveTitle,
              familyLabels: copy.familyLabels,
              seriesLink: copy.gradient.deepDiveSeriesLink,
            }}
          />
        );
      case "atlas-entry":
        return (
          <IndexEntryCard
            heading={
              atlas.published
                ? copy.gradient.atlasHeadingPublished
                : copy.gradient.atlasHeadingUnpublished
            }
            entryHref={atlas.href}
            entryLabel={copy.gradient.viewAll}
            latest={atlas.latest}
            copy={indexCopy}
          />
        );
      case "mkt12-weekend":
        return (
          <IndexEntryCard
            heading={copy.familyLabels["mkt12-weekend"]}
            entryHref="/articles/series/mkt12-weekend"
            entryLabel={copy.gradient.viewAll}
            latest={slots.mkt12WeekendLatest}
            copy={indexCopy}
          />
        );
      case "weekly-brief":
        return (
          <IndexEntryCard
            heading={copy.familyLabels["weekly-brief"]}
            entryHref="/articles/series/weekly-brief"
            entryLabel={copy.gradient.viewAll}
            latest={slots.weeklyBriefLatest}
            copy={indexCopy}
          />
        );
      case "restart-map":
        // 2026-10-29 田平氏 GO (C 案): 新着順に混ぜ、確定した段階の 1 行を添える
        return (
          <IndexEntryCard
            heading={copy.familyLabels["restart-map"]}
            entryHref="/articles/series/restart-map"
            entryLabel={copy.gradient.viewAll}
            latest={slots.restartMapLatest}
            copy={indexCopy}
            stageLine={
              slots.restartMapLatest
                ? restartStageSummary(slots.restartMapLatest.articleId)
                : null
            }
          />
        );
      case "event-risk-mobile":
        // 2026-10-26 田平氏 GO: スマホでは Event Risk を最新記事の直前に出す
        // (左列の event-risk はスマホで非表示・この写しは PC で非表示・索引扱い)
        return (
          <div data-index-nav>
            <EventRiskModule
              article={slots.eventRiskLatest}
              familyLabels={copy.familyLabels}
            />
          </div>
        );
      case "latest-articles":
        return (
          <LatestArticlesCard
            articles={slots.latestArticles}
            copy={{
              title: copy.gradient.latestTitle,
              familyLabels: copy.familyLabels,
              laneLabels: copy.lanes.titles,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section
      data-ledger-group={REGION}
      data-lagging-order="newest-first"
      className="min-w-0 space-y-6"
    >
      {modules.map((module) =>
        module === "turning-point-reserved" ? (
          <div
            key={module}
            data-column-module={module}
            hidden
            aria-hidden="true"
          />
        ) : (
          <div
            key={module}
            data-column-module={module}
            className={MODULE_CLASSNAMES[module]}
          >
            {renderModule(module)}
          </div>
        ),
      )}
    </section>
  );
}
