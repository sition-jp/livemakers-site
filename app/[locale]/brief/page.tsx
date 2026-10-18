import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BriefList } from "@/components/brief/BriefList";
import { getAllBriefs } from "@/lib/briefs";
import { localeAlternates } from "@/lib/seo/locale-alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brief" });
  return {
    title: t("title"),
    alternates: localeAlternates(locale, "/brief"),
  };
}

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
