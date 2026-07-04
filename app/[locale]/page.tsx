import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReaderIntelligenceTerminal } from "@/components/terminal/ReaderIntelligenceTerminal";
import { TickerBar } from "@/components/terminal/TickerBar";
import { SiteTagline } from "@/components/terminal/SiteTagline";
import { getReviewedReaderTerminalSource } from "@/lib/livemakers-terminal-preview/reader-terminal-source";

/**
 * G39-A2: the homepage is the reader intelligence terminal, full stop.
 * The Cardano/Midnight-centered WEEKLY BRIEFS framing (EditorialHero /
 * NetworkPulse / FourPanelStatus / RecentBriefs) is retired per doctrine
 * §2/§5 — past briefs stay reachable through the /brief archive, linked
 * from the Published Intelligence window.
 */
export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const readerTerminalLocale = locale === "ja" ? "ja" : "en";
  const readerTerminalT = await getTranslations("overview.readerTerminal");
  const readerTerminalSource = getReviewedReaderTerminalSource();

  return (
    <>
      <TickerBar />
      <SiteTagline />
      <ReaderIntelligenceTerminal
        locale={readerTerminalLocale}
        data={readerTerminalSource.data}
        sourceProvenance={readerTerminalSource.provenance}
        copy={{
          eyebrow: readerTerminalT("eyebrow"),
          title: readerTerminalT("title"),
          subtitle: readerTerminalT("subtitle"),
          sessionVisibilityTitle: readerTerminalT("sessionVisibilityTitle"),
          sessionVisibilityAsOf: readerTerminalT("sessionVisibilityAsOf"),
          sessionVisibilityPacket: readerTerminalT("sessionVisibilityPacket"),
          laneMacro: readerTerminalT("laneMacro"),
          laneCrypto: readerTerminalT("laneCrypto"),
          laneRwa: readerTerminalT("laneRwa"),
          fixtureLabel: readerTerminalT("fixtureLabel"),
          titleOnlyBadge: readerTerminalT("titleOnlyBadge"),
          archiveLinkLabel: readerTerminalT("archiveLinkLabel"),
          sourceStatusTitle: readerTerminalT("sourceStatusTitle"),
          sourceStatusReviewed: readerTerminalT("sourceStatusReviewed"),
          sourceStatusFixtureOnly: readerTerminalT("sourceStatusFixtureOnly"),
          sourceStatusReviewedAt: readerTerminalT("sourceStatusReviewedAt"),
          sourceStatusPacket: readerTerminalT("sourceStatusPacket"),
        }}
      />
    </>
  );
}
