import type {
  buildHomeCompositionProps,
  HomeRadarSource,
  HomeSessionsSource,
} from "@/lib/home/build-home-props";
import type { HomeCopy } from "@/lib/home/home-copy";
import type { HomeCatalogSource } from "@/lib/home/load-home-composition";
import { CompositeHero } from "./CompositeHero";
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
};

/**
 * トップ組成 = 勾配 3 カラムシェル (G44 D1/D2/D8)。
 * DOM 順 = hero → leading → coincident → lagging (勾配台帳 GRADIENT_REGIONS)。
 * mobile〜lg は単一カラム縦積み・xl (1280px) で 3 カラム
 * (1fr / 1.15fr / 1fr・各カラムは独立フロー)。masthead は page.tsx 直下へ
 * 移設済み (台帳対象外の chrome 項 0)。
 */
export function HomeComposition({
  live,
  schedule,
  slots,
  focusSeries,
  focusSessionSlug,
  snapshot,
  coreCells,
  laneCells,
  laneProvenance,
  mkt12Provenance,
  sessionProvenance,
  copy,
  surfacePublished,
  catalogSource = "repository_only",
  radarSource = "empty",
  sessionsSource = "repo",
  showSessionEditorial = true,
}: HomeCompositionProps) {
  return (
    <div
      data-home-catalog-source={catalogSource}
      data-home-radar-source={radarSource}
      data-home-sessions-source={sessionsSource}
      data-home-sessions-editorial={live?.editorial ? "present" : "absent"}
      className="mx-auto max-w-[1760px] px-4 pb-10 pt-6 md:px-8"
    >
      <CompositeHero
        live={live}
        lead={slots.lead}
        copy={copy.hero}
        editorialCopy={copy.sessionNow}
        showSessionEditorial={showSessionEditorial}
      />
      <div className="mt-8 space-y-8 xl:mt-8 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] xl:gap-8 xl:space-y-0">
        <LeadingColumn
          live={live}
          schedule={schedule}
          slots={slots}
          focusSeries={focusSeries}
          focusSessionSlug={focusSessionSlug}
          sessionProvenance={sessionProvenance}
          copy={copy}
          showSessionEditorial={showSessionEditorial}
        />
        <CoincidentColumn
          slots={slots}
          snapshot={snapshot}
          coreCells={coreCells}
          laneCells={laneCells}
          laneProvenance={laneProvenance}
          mkt12Provenance={mkt12Provenance}
          copy={copy}
        />
        <LaggingColumn
          slots={slots}
          surfacePublished={surfacePublished}
          copy={copy}
        />
      </div>
    </div>
  );
}
