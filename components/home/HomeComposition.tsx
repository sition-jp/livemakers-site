import { ArticleCardSmall } from "./ArticleCardSmall";
import { IndicatorTileCard } from "./IndicatorTileCard";
import { LaneBlock } from "./LaneBlock";
import { LeadArticleCard } from "./LeadArticleCard";
import { LibraryShelf } from "./LibraryShelf";
import { PairSection } from "./PairSection";
import { RadarObservationsCard } from "./RadarObservationsCard";
import { RadarPromotedCard } from "./RadarPromotedCard";
import { RecentSignalsCard } from "./RecentSignalsCard";
import { SeriesIndexCard } from "./SeriesIndexCard";
import { SessionFocusChart } from "./SessionFocusChart";
import { SessionNowCard } from "./SessionNowCard";
import { SessionScheduleCard } from "./SessionScheduleCard";
import { TopMoversCard } from "./TopMoversCard";
import { Link } from "@/i18n/navigation";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import type { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import type { HomeCopy } from "@/lib/home/home-copy";

export type HomeCompositionProps = ReturnType<
  typeof buildHomeCompositionProps
> & { copy: HomeCopy };

export function HomeComposition({
  live,
  schedule,
  slots,
  focusSeries,
  snapshot,
  coreCells,
  laneCells,
  pageProvenance,
  mkt12Provenance,
  sessionProvenance,
  copy,
}: HomeCompositionProps) {
  const familyLabels = copy.lanes.block.familyLabels;
  const mkt12Articles = [
    slots.mkt12.article,
    slots.mkt12.weekend,
    ...slots.mkt12.archive,
  ].filter((article) => article !== null);
  const sessionName = live
    ? getSessionBySlug(live.sessionSlug).nameEn
    : copy.noLiveSession;

  return (
    <div className="mx-auto max-w-[1330px] space-y-8 px-4 pb-10 pt-6 md:px-8">
      <section data-ledger-group="lead" className="home-lead-grid">
        <div data-lead-module="session-now" style={{ gridArea: "session" }}>
          {live && sessionProvenance ? (
            <SessionNowCard
              record={live}
              provenance={sessionProvenance}
              copy={copy.sessionNow}
            />
          ) : (
            <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-tertiary">
              {copy.noLiveSession}
            </section>
          )}
        </div>
        <div data-lead-module="lead-article" style={{ gridArea: "lead" }}>
          <LeadArticleCard slot={slots.lead} labels={copy.lead} />
        </div>
        <div data-lead-module="schedule" style={{ gridArea: "schedule" }}>
          <div className="md:hidden">
            <SessionScheduleCard
              schedule={schedule}
              copy={copy.schedule}
              variant="compact"
            />
          </div>
          <div className="hidden md:block">
            <SessionScheduleCard schedule={schedule} copy={copy.schedule} />
          </div>
        </div>
        <div
          data-lead-module="focus"
          style={{ gridArea: "focus" }}
          className="hidden md:block"
        >
          <SessionFocusChart
            sessionName={sessionName}
            series={focusSeries}
            unavailableLabel={copy.unavailable}
            copy={copy.focus}
          />
        </div>
        <div
          data-lead-module="series-index"
          style={{ gridArea: "series" }}
          className="hidden md:block"
        >
          <SeriesIndexCard copy={copy.seriesIndex} />
        </div>
      </section>

      <section data-ledger-group="mkt12">
        <PairSection
          title={copy.mkt12.sectionTitle}
          jointLabel={copy.mkt12.jointLabel}
          left={
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
          }
          right={
            <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
              <h3 className="text-sm font-bold text-text-primary">
                {copy.mkt12.articleTitle}
              </h3>
              {slots.mkt12.state === "awaiting" ? (
                <div className="mt-3 rounded bg-bg-tertiary p-3 text-xs text-text-secondary">
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
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {mkt12Articles.map((article) => (
                  <ArticleCardSmall
                    key={article.articleId}
                    article={article}
                    familyLabel={familyLabels[article.family]}
                  />
                ))}
              </div>
            </section>
          }
        />
      </section>

      <section data-ledger-group="flash" className="space-y-4">
        <PairSection
          title={copy.radar.sectionTitle}
          jointLabel={copy.radar.jointLabel}
          left={
            slots.radarPair ? (
              <RadarPromotedCard
                observation={slots.radarPair.observation}
                publishedLabel={slots.radarPair.article.publishedAtJst.slice(
                  11,
                  16,
                )}
                copy={copy.radar.promoted}
              />
            ) : null
          }
          right={
            slots.radarPair ? (
              <ArticleCardSmall
                article={slots.radarPair.article}
                familyLabel={familyLabels[slots.radarPair.article.family]}
              />
            ) : null
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          <RadarObservationsCard
            observations={slots.observing}
            copy={copy.radar.observations}
          />
          <RecentSignalsCard
            articles={slots.recentSignals}
            copy={copy.radar.recent}
          />
        </div>
      </section>

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {(["macro", "crypto", "rwa"] as const).map((lane) => {
          const laneSlot = slots.lanes.find(
            (candidate) => candidate.lane === lane,
          )!;
          return (
            <section key={lane} data-ledger-group={`lane-${lane}`}>
              <LaneBlock
                lane={lane}
                title={copy.lanes.titles[lane]}
                subtitle={copy.lanes.subtitle}
                rows={laneCells[lane]}
                articles={laneSlot.articles}
                asOfLabel={snapshot.asOfLabel}
                provenance={pageProvenance}
                copy={copy.lanes.block}
              />
            </section>
          );
        })}
      </div>

      <section
        data-ledger-group="turning-point-reserved"
        hidden
        aria-hidden="true"
      />

      <section data-ledger-group="library">
        <h2 className="mb-3 text-lg font-bold text-text-primary">
          {copy.library.title}
        </h2>
        <LibraryShelf articles={slots.library} copy={copy.library.shelf} />
      </section>
    </div>
  );
}
