import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import type { HomeCompositionProps } from "../HomeComposition";

const REGION = "lagging" satisfies GradientRegion;

/**
 * 右カラム = 遅行 (G44 D7)。モジュール順は勾配台帳 REGION_MODULES.lagging。
 * T7 時点では全モジュールが空プレースホルダ (T9 が DeepDiveShelf /
 * IndexEntryCard 群 / LatestArticlesCard を実装して埋める)。
 * turning-point-reserved は非表示の予約席として維持する。
 */
export type LaggingColumnProps = Pick<HomeCompositionProps, "surfacePublished">;

export function LaggingColumn({ surfacePublished }: LaggingColumnProps) {
  // T9 が atlas-entry モジュールで消費する (buildAtlasEntry(surfacePublished,
  // slots.atlasLatest) — D4 flag-aware 入口)。page.tsx → HomeComposition →
  // LaggingColumn の配線を先に typecheck 可能にするため T7 で thread 済み。
  void surfacePublished;

  return (
    <section data-ledger-group={REGION} className="min-w-0 space-y-6">
      {REGION_MODULES[REGION].map((module) =>
        module === "turning-point-reserved" ? (
          <div
            key={module}
            data-column-module={module}
            hidden
            aria-hidden="true"
          />
        ) : (
          <div key={module} data-column-module={module} />
        ),
      )}
    </section>
  );
}
