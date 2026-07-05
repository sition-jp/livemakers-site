import { Link } from "@/i18n/navigation";
import type { ReviewedReaderTerminalSourceProvenance } from "@/lib/livemakers-terminal-preview/reader-terminal-source";
import type {
  LocalizedText,
  TerminalLiveRadarItem,
  TerminalPreviewLocale,
  TerminalPreviewMock,
} from "@/lib/livemakers-terminal-preview/types";
import type {
  LiveRadarData,
  PublishedFeedData,
  ScheduledSessionTimes,
  SourceFeedData,
} from "@/lib/terminal/live-market-feed";
import type { SiteNativePublishedFeed } from "@/lib/terminal/published-window";
import {
  marketLanesFixture,
  type MarketLane,
  type MarketLaneKey,
} from "@/lib/terminal/market-lanes";

export interface ReaderIntelligenceTerminalCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  sessionVisibilityTitle: string;
  sessionVisibilityAsOf: string;
  sessionVisibilityPacket: string;
  laneMacro: string;
  laneCrypto: string;
  laneRwa: string;
  fixtureLabel: string;
  radarUpdatedLabel: string;
  radarNextSessionLabel: string;
  titleOnlyBadge: string;
  archiveLinkLabel: string;
  publishedOnXLabel: string;
  sourceStatusTitle: string;
  sourceStatusReviewed: string;
  sourceStatusFixtureOnly: string;
  sourceStatusReviewedAt: string;
  sourceStatusPacket: string;
}

function pick(text: LocalizedText, locale: TerminalPreviewLocale): string {
  return locale === "ja" ? text.ja : text.en;
}

/* Doctrine §4: the left status stripe is the non-clickable radar item's
   primary visual signal — amber while checking, cyan once it entered the
   SDE review lane, red for breaking. */
const radarStripe: Record<TerminalLiveRadarItem["status"], string> = {
  checking: "border-l-pillar-governance",
  sde_review_pending: "border-l-pillar-market",
  breaking: "border-l-pillar-risk",
};

const laneAccent: Record<MarketLaneKey, string> = {
  macro: "bg-text-tertiary",
  crypto: "bg-pillar-market",
  rwa: "bg-pillar-ecosystem",
};

function WindowHeading({
  id,
  label,
  accent,
  aside,
}: {
  id: string;
  label: string;
  accent?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-t border-border-primary pt-3">
      <h3
        id={id}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-label text-text-tertiary"
      >
        {accent && (
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${accent}`} />
        )}
        {label}
      </h3>
      {aside}
    </div>
  );
}

function FixtureMark({ label }: { label: string }) {
  return (
    <span className="shrink-0 font-mono text-[9px] uppercase tracking-normal text-text-tertiary">
      {label}
    </span>
  );
}

export function ReaderIntelligenceTerminal({
  locale,
  data,
  copy,
  sourceProvenance,
  marketLanes = marketLanesFixture,
  liveRadar: liveRadarFeed = null,
  scheduledSession = null,
  articleNewsFeed: liveArticleNewsFeed = null,
  publishedPosts = null,
  sourceFeed = null,
}: {
  locale: TerminalPreviewLocale;
  data: TerminalPreviewMock;
  copy: ReaderIntelligenceTerminalCopy;
  sourceProvenance?: ReviewedReaderTerminalSourceProvenance;
  marketLanes?: MarketLane[];
  liveRadar?: LiveRadarData | null;
  scheduledSession?: ScheduledSessionTimes | null;
  articleNewsFeed?: SiteNativePublishedFeed | null;
  publishedPosts?: PublishedFeedData | null;
  sourceFeed?: SourceFeedData | null;
}) {
  const { scheduledSessionVisibility, liveRadar } = data.publicTopology;

  /* G39-B B4: the Published window prefers the site-native brief feed (built
     from disk); the reviewed fixture is the fallback. The X-published posts
     render as a clearly-separated, badge-marked secondary feed below. */
  const articleNewsFeed =
    liveArticleNewsFeed ?? data.publicTopology.articleNewsFeed;

  /* G39-B B3: the radar window prefers the delivered (validator-gated) feed
     items; the reviewed fixture is the degraded state. The header stays
     honest about cadence: session badge + updated time + next session time
     ("RADAR — as of HH:MM", never a realtime claim). */
  const radarItems = liveRadarFeed?.items ?? liveRadar.items;
  const radarAside = liveRadarFeed
    ? [
        liveRadarFeed.badge,
        liveRadarFeed.asOfLabel &&
          `${copy.radarUpdatedLabel} ${liveRadarFeed.asOfLabel}`,
        scheduledSession?.nextScheduledLabel &&
          `${copy.radarNextSessionLabel} ${scheduledSession.nextScheduledLabel}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : copy.fixtureLabel;

  const laneLabel: Record<MarketLaneKey, string> = {
    macro: copy.laneMacro,
    crypto: copy.laneCrypto,
    rwa: copy.laneRwa,
  };

  const [featured, ...feedRest] = articleNewsFeed.items;

  return (
    <section
      aria-labelledby="reader-intelligence-terminal-title"
      className="mx-auto box-border w-full max-w-[1920px] px-6 py-10"
    >
      {/* Terminal masthead — flattened: rules + labels, no section boxes */}
      <div className="grid min-w-0 gap-4 border-t border-border-primary pt-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
            {copy.eyebrow}
          </p>
          <h2
            id="reader-intelligence-terminal-title"
            className="text-3xl font-light leading-tight text-text-primary md:text-4xl"
          >
            {copy.title}
          </h2>
        </div>
        <div className="grid min-w-0 gap-3">
          <p className="text-sm leading-relaxed text-text-secondary">
            {copy.subtitle}
          </p>
          <p className="font-mono text-[11px] text-text-tertiary">
            {data.terminalState.asOfJst}
          </p>
          {sourceProvenance && (
            <div
              aria-label={copy.sourceStatusTitle}
              className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-label text-text-tertiary"
            >
              <span className="text-text-secondary">
                {copy.sourceStatusTitle}
              </span>
              <span className="border border-border-primary px-2 py-0.5 text-pillar-overview">
                <span>{copy.sourceStatusReviewed}</span>
                <span className="ml-2 font-mono normal-case tracking-normal text-text-primary">
                  {sourceProvenance.reviewStatus}
                </span>
              </span>
              <span className="border border-border-primary px-2 py-0.5">
                <span>{copy.sourceStatusFixtureOnly}</span>
                <span className="ml-2 font-mono normal-case tracking-normal text-text-primary">
                  {sourceProvenance.sourceMode}
                </span>
              </span>
              <span className="font-mono normal-case tracking-normal">
                {copy.sourceStatusReviewedAt} {sourceProvenance.reviewedAt}
              </span>
              <span className="font-mono normal-case tracking-normal">
                {copy.sourceStatusPacket} {sourceProvenance.packetId}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Doctrine §4 window grid. DOM order = the fixed window ledger:
          Live Radar → macro → crypto → RWA → Published Intelligence → Source.
          Columns grow with container width (auto-fit); mobile stacks in the
          same order. */}
      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-x-6 gap-y-8">
        {/* 1. Live Radar window (non-clickable early-alert surface) */}
        <section aria-labelledby="window-live-radar" className="min-w-0">
          <WindowHeading
            id="window-live-radar"
            label={pick(liveRadar.title, locale)}
            accent="bg-pillar-market"
            aside={
              /* The session label is long — unlike FixtureMark it must be
                 allowed to shrink and wrap so the heading keeps its width. */
              <span className="min-w-0 text-right font-mono text-[9px] uppercase tracking-normal text-text-tertiary">
                {radarAside}
              </span>
            }
          />
          <div className="space-y-3">
            {radarItems.map((item) => (
              <article
                key={item.id}
                className={`border border-border-primary border-l-2 bg-bg-secondary/40 p-4 ${radarStripe[item.status]}`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                    {pick(item.sourceLabel, locale)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-label text-pillar-market">
                    {item.family}
                  </span>
                  <span className="border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-pillar-risk">
                    {copy.titleOnlyBadge}
                  </span>
                </div>
                <h4 className="text-sm font-semibold leading-snug text-text-primary">
                  {pick(item.title, locale)}
                </h4>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                  {item.status}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-text-tertiary">
                  <span>{item.displayMode}</span>
                  <span>{item.publishDecision}</span>
                </div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                  {pick(item.freshnessLabel, locale)}
                </p>
              </article>
            ))}
          </div>

          {scheduledSessionVisibility && (
            <details className="mt-4 border border-border-primary bg-bg-primary">
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 p-4">
                <span>
                  <h3 className="inline text-xs font-semibold uppercase tracking-label text-text-tertiary">
                    {copy.sessionVisibilityTitle}
                  </h3>
                  <span className="ml-2 text-sm font-semibold text-text-primary">
                    {pick(scheduledSessionVisibility.sessionLabel, locale)}
                  </span>
                </span>
                <span className="space-x-3 font-mono text-[10px] text-text-tertiary">
                  <span>
                    {copy.sessionVisibilityAsOf}{" "}
                    {scheduledSessionVisibility.asOfJst}
                  </span>
                  <span>
                    {copy.sessionVisibilityPacket}{" "}
                    {scheduledSessionVisibility.sourcePacketId}
                  </span>
                </span>
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {scheduledSessionVisibility.items.map((item) => (
                  <article
                    key={item.id}
                    className="border border-border-primary bg-bg-secondary/40 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="border border-border-primary px-2 py-0.5 font-mono text-[10px] font-semibold normal-case tracking-normal text-pillar-overview">
                        {item.status}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                        {item.family}
                      </span>
                    </div>
                    <h4 className="mb-2 text-sm font-semibold leading-snug text-text-primary">
                      {pick(item.title, locale)}
                    </h4>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {pick(item.summary, locale)}
                    </p>
                    <p className="mt-3 font-mono text-[10px] text-text-tertiary">
                      {item.reasonCode}
                    </p>
                  </article>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* 2–4. Market lane windows (macro → crypto → RWA) */}
        {marketLanes.map((lane) => (
          <section
            key={lane.key}
            aria-labelledby={`window-lane-${lane.key}`}
            className="min-w-0"
          >
            <WindowHeading
              id={`window-lane-${lane.key}`}
              label={laneLabel[lane.key]}
              accent={laneAccent[lane.key]}
              aside={<FixtureMark label={lane.badge ?? copy.fixtureLabel} />}
            />
            <div className="grid gap-3">
              {lane.tiles.map((tile) => {
                const delta =
                  tile.deltaPct === undefined
                    ? null
                    : `${tile.deltaPct > 0 ? "+" : ""}${tile.deltaPct.toFixed(1)}%`;
                return (
                  <article
                    key={tile.id}
                    className="min-w-0 border border-border-primary bg-bg-primary p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="truncate text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                        {tile.label}
                      </span>
                      {/* G39-B B2: live tiles carry their own freshness badge
                          (SNAPSHOT / SESSION); fixture tiles keep FIXTURE. */}
                      <FixtureMark label={tile.badge ?? copy.fixtureLabel} />
                    </div>
                    <p className="mb-1 truncate text-2xl font-light tabular-nums text-text-primary">
                      {tile.value ?? "—"}
                      {delta && (
                        <span
                          className={`ml-2 text-sm tabular-nums ${
                            delta.startsWith("-")
                              ? "text-status-down"
                              : "text-status-up"
                          }`}
                        >
                          {delta}
                        </span>
                      )}
                    </p>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      {pick(tile.note, locale)}
                    </p>
                    {tile.asOfLabel && (
                      <p className="mt-2 font-mono text-[10px] text-text-tertiary">
                        {tile.asOfLabel}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {/* 5. Published Intelligence window — the only clickable surface */}
        <section
          aria-labelledby="window-published"
          className="col-span-full min-w-0"
        >
          <WindowHeading
            id="window-published"
            label={pick(articleNewsFeed.title, locale)}
            accent="bg-pillar-overview"
          />
          {featured && (
            <article className="border-b border-border-primary pb-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-pillar-overview">
                  {featured.family}
                </span>
                <span className="font-mono text-[10px] text-text-tertiary">
                  {featured.publishedAt}
                </span>
              </div>
              <Link href={featured.href} className="group block">
                <h4 className="mb-2 text-xl font-light leading-snug text-text-primary group-hover:text-pillar-overview md:text-2xl">
                  {pick(featured.title, locale)}
                </h4>
                <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
                  {pick(featured.excerpt, locale)}
                </p>
              </Link>
            </article>
          )}
          {feedRest.length > 0 && (
            <div className="grid gap-x-8 sm:grid-cols-2">
              {feedRest.map((item) => (
                <article
                  key={item.id}
                  className="border-b border-border-primary py-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-pillar-overview">
                      {item.family}
                    </span>
                    <span className="font-mono text-[10px] text-text-tertiary">
                      {item.publishedAt}
                    </span>
                  </div>
                  <Link href={item.href} className="group block">
                    <h4 className="mb-2 text-sm font-semibold leading-snug text-text-primary group-hover:text-pillar-overview">
                      {pick(item.title, locale)}
                    </h4>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {pick(item.excerpt, locale)}
                    </p>
                  </Link>
                </article>
              ))}
            </div>
          )}
          {publishedPosts && publishedPosts.items.length > 0 && (
            <div className="mt-6 border-t border-border-primary pt-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                {copy.publishedOnXLabel}
              </p>
              <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                {publishedPosts.items.map((post) => (
                  <li key={post.url} className="py-1.5">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-baseline gap-2"
                    >
                      <span className="shrink-0 border border-border-primary px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-label text-text-tertiary">
                        {post.account}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs leading-relaxed text-text-secondary group-hover:text-pillar-overview">
                        {post.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-text-tertiary">
                        {post.date}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            href="/brief"
            className="mt-4 inline-block border border-border-primary px-4 py-2 text-xs tracking-label text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          >
            {copy.archiveLinkLabel} →
          </Link>
        </section>

        {sourceFeed && (
          <section
            aria-labelledby="window-source"
            className="col-span-full min-w-0"
          >
            <WindowHeading
              id="window-source"
              label={pick(sourceFeed.title, locale)}
              accent="bg-pillar-governance"
              aside={
                <span className="min-w-0 text-right font-mono text-[9px] uppercase tracking-normal text-text-tertiary">
                  {[sourceFeed.badge, sourceFeed.asOfLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              }
            />
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {sourceFeed.items.map((item) => (
                <article
                  key={item.id}
                  className="min-w-0 border border-border-primary bg-bg-primary p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-pillar-governance">
                      {pick(item.category, locale)}
                    </span>
                    <span className="font-mono text-[10px] text-text-tertiary">
                      {item.sourceDomain}
                    </span>
                    <span className="font-mono text-[10px] text-text-tertiary">
                      {pick(item.freshnessLabel, locale)}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold leading-snug text-text-primary">
                    {pick(item.title, locale)}
                  </h4>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
