import { getTranslations, setRequestLocale } from "next-intl/server";

import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { HomeComposition } from "@/components/home/HomeComposition";
import { TickerBar } from "@/components/terminal/TickerBar";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { buildHomeCopy } from "@/lib/home/home-copy";
import { READER_SESSIONS } from "@/lib/sessions/session-registry";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const props = buildHomeCompositionProps();
  const currentIndex = props.live
    ? READER_SESSIONS.findIndex(
        (session) => session.slug === props.live?.sessionSlug,
      )
    : -1;
  const nextSession =
    READER_SESSIONS[(currentIndex + 1) % READER_SESSIONS.length];
  const copy = buildHomeCopy(
    (key, values) => t(key as never, values as never),
    {
      sessionName: props.live
        ? READER_SESSIONS.find(
            (session) => session.slug === props.live?.sessionSlug,
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
      <HomeComposition {...props} copy={copy} />
    </>
  );
}
