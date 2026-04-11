import { setRequestLocale } from "next-intl/server";
import { BriefList } from "@/components/brief/BriefList";
import { getAllBriefs } from "@/lib/briefs";

export default async function BriefIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const briefs = getAllBriefs();
  return <BriefList briefs={briefs} locale={locale} />;
}
