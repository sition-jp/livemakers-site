import type { ReactNode } from "react";

import { buildAtlasEntry } from "@/lib/home/atlas-entry";
import { type GradientRegion } from "@/lib/home/gradient-ledger";
import { orderLaggingModules } from "@/lib/home/lagging-order";
import type { HomeCompositionProps } from "../HomeComposition";
import { DeepDiveShelf } from "../DeepDiveShelf";
import { IndexEntryCard } from "../IndexEntryCard";
import { LatestArticlesCard } from "../LatestArticlesCard";

const REGION = "lagging" satisfies GradientRegion;

/**
 * 右カラム = 遅行 (索引) (G44 D7)。モジュールの集合と末尾固定枠は勾配台帳
 * REGION_MODULES.lagging。**記事 4 枠 (Deep Dive / 未来アトラス / 週末の12指標 /
 * Weekly Brief) は各枠の最新記事の公開順に動的に並ぶ** (2026-08-23 田平氏 GO A・
 * `orderLaggingModules`)。⑤ 最新記事 ⑥ Turning Point 予約席 (非表示) は末尾固定。
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
            entryHref="/brief"
            entryLabel={copy.gradient.viewAll}
            latest={slots.weeklyBriefLatest}
            copy={indexCopy}
          />
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
          <div key={module} data-column-module={module}>
            {renderModule(module)}
          </div>
        ),
      )}
    </section>
  );
}
