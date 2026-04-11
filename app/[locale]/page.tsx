import { setRequestLocale } from "next-intl/server";
import { getAllBriefs, getLatestBrief } from "@/lib/briefs";
import { TickerBar } from "@/components/terminal/TickerBar";
import { EditorialHero } from "@/components/terminal/EditorialHero";
import { NetworkPulse } from "@/components/terminal/NetworkPulse";
import { FourPanelStatus } from "@/components/terminal/FourPanelStatus";
import { RecentBriefs } from "@/components/terminal/RecentBriefs";
import { SectionDivider } from "@/components/ui/SectionDivider";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const latest = getLatestBrief();
  const allBriefs = getAllBriefs();
  const recent = allBriefs.filter((b) => b.slug !== latest?.slug).slice(0, 3);

  return (
    <>
      <TickerBar />
      {latest && (
        <>
          <EditorialHero brief={latest} locale={locale} />
          <NetworkPulse snapshot={latest.metadata.ticker_snapshot} />
          <FourPanelStatus summary={latest.metadata.four_panel_summary} locale={locale} />
          <SectionDivider />
          <RecentBriefs briefs={recent} locale={locale} />
        </>
      )}
      {!latest && (
        <section className="mx-auto max-w-7xl px-6 py-32 text-center text-text-tertiary">
          No briefs published yet.
        </section>
      )}
    </>
  );
}
