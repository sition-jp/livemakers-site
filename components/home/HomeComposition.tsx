import type {
  buildHomeCompositionProps,
  HomeRadarSource,
  HomeSessionsSource,
} from "@/lib/home/build-home-props";
import type { HomeCopy } from "@/lib/home/home-copy";
import type { HomeCatalogSource } from "@/lib/home/load-home-composition";
import type { VideoRailCardProps } from "@/components/videos/VideoRailCard";
import { FlashBand } from "./FlashBand";
import { CoincidentColumn } from "./columns/CoincidentColumn";
import { LaggingColumn } from "./columns/LaggingColumn";
import { LeadingColumn } from "./columns/LeadingColumn";

export type HomeCompositionProps = ReturnType<
  typeof buildHomeCompositionProps
> & {
  copy: HomeCopy;
  surfacePublished: boolean;
  catalogSource?: HomeCatalogSource;
  /** G43-d (fix round 1): resolved outside the builder — see load-home-composition.ts. */
  radarSource?: HomeRadarSource;
  /** G43-e (S2): resolved outside the builder — same posture, see load-home-composition.ts. */
  sessionsSource?: HomeSessionsSource;
  showSessionEditorial?: boolean;
  /** 2026-09-21: 速報帯の表示言語 (page.tsx の locale)。省略時 ja。 */
  locale?: string;
  /** 2026-10-31: 右列の「最新の動画」(YouTube に上がった回が無ければ null)。 */
  videoCard?: Omit<VideoRailCardProps, "placement"> | null;
};

/**
 * トップ組成 = 勾配 3 カラムシェル (G44 D1/D2/D8)。
 * DOM 順 = leading → coincident → lagging (勾配台帳 GRADIENT_REGIONS・2026-10-26 に
 * スマホ専用の hero を廃止)。
 * mobile〜lg は単一カラム縦積み・xl (1280px) で 3 カラム
 * (1fr / 1.15fr / 1fr・各カラムは独立フロー)。masthead は page.tsx 直下へ
 * 移設済み (台帳対象外の chrome 項 0)。
 */
export function HomeComposition({
  live,
  recentClosed,
  recentClosedProvenance,
  schedule,
  slots,
  focusSeries,
  focusSessionSlug,
  snapshot,
  coreCells,
  laneCells,
  laneProvenance,
  alt20,
  mkt12Provenance,
  sessionProvenance,
  copy,
  surfacePublished,
  catalogSource = "repository_only",
  radarSource = "empty",
  sessionsSource = "repo",
  showSessionEditorial = true,
  locale = "ja",
  videoCard = null,
}: HomeCompositionProps) {
  return (
    <div
      data-home-catalog-source={catalogSource}
      data-home-radar-source={radarSource}
      data-home-sessions-source={sessionsSource}
      data-home-sessions-editorial={live?.editorial ? "present" : "absent"}
      className="mx-auto max-w-[1760px] px-4 pb-10 pt-6 md:px-8"
    >
      <FlashBand article={slots.flashLatest} locale={locale} />
      {/* masthead 直下の空白は wrapper pt-6 の 24px (2026-08-14 田平氏指示)。
          2026-10-26: スマホ専用の hero を廃止したので、どの幅でも mt を付けない。 */}
      <div className="space-y-8 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] xl:gap-8 xl:space-y-0">
        <LeadingColumn
          live={live}
          recentClosed={recentClosed}
          recentClosedProvenance={recentClosedProvenance}
          schedule={schedule}
          slots={slots}
          focusSeries={focusSeries}
          focusSessionSlug={focusSessionSlug}
          sessionProvenance={sessionProvenance}
          copy={copy}
          showSessionEditorial={showSessionEditorial}
          locale={locale}
        />
        <CoincidentColumn
          slots={slots}
          snapshot={snapshot}
          coreCells={coreCells}
          laneCells={laneCells}
          laneProvenance={laneProvenance}
          alt20={alt20}
          mkt12Provenance={mkt12Provenance}
          copy={copy}
        />
        <LaggingColumn
          slots={slots}
          surfacePublished={surfacePublished}
          copy={copy}
          videoCard={videoCard}
        />
      </div>
    </div>
  );
}
