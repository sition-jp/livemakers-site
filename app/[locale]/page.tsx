import { getTranslations, setRequestLocale } from "next-intl/server";

import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { HomeComposition } from "@/components/home/HomeComposition";
import { TickerBar } from "@/components/terminal/TickerBar";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { buildHomeCopy } from "@/lib/home/home-copy";
import { loadHomeCompositionProps } from "@/lib/home/load-home-composition";
import { READER_SESSIONS } from "@/lib/sessions/session-registry";

export const revalidate = 300;

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const props = await loadHomeCompositionProps();
  const futureAtlas = await loadFutureAtlas();
  const currentIndex = props.focusSessionSlug
    ? READER_SESSIONS.findIndex(
        (session) => session.slug === props.focusSessionSlug,
      )
    : -1;
  const nextSession =
    READER_SESSIONS[(currentIndex + 1) % READER_SESSIONS.length];
  const copy = buildHomeCopy(
    (key, values) => t(key as never, values as never),
    {
      sessionName: props.focusSessionSlug
        ? READER_SESSIONS.find(
            (session) => session.slug === props.focusSessionSlug,
          )!.nameEn
        : t("general.noLiveSession"),
      nextSessionName: nextSession.nameEn,
      nextSessionTime: nextSession.updateTimeLabel,
      remainingSessions: props.schedule.filter((item) => !item.isCurrent)
        .length,
    },
  );

  return (
    <>
      <TickerBar items={props.tickerItems} />
      <GlobalProvenanceStrip
        provenance={props.pageProvenance}
        labels={copy.provenance}
        note={copy.globalProvenanceNote}
      />
      {/* masthead は勾配台帳の対象外 (chrome 項 0) — data-ledger-group の
          外側・page 直下の全幅 header として描画する (G44 D8/P3-6)。 */}
      <header className="w-full">
        <div className="mx-auto max-w-[1760px] px-4 pt-6 md:px-8">
          <h1 className="text-xl font-bold text-text-primary md:text-2xl">
            {copy.masthead.title}
          </h1>
          <p className="mt-1 text-[11px] text-text-tertiary">
            {copy.masthead.subtitle}
          </p>
        </div>
      </header>
      <HomeComposition
        {...props}
        copy={copy}
        surfacePublished={futureAtlas.config.surfacePublished}
      />
    </>
  );
}
