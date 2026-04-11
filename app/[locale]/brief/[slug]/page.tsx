import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getBriefBySlug } from "@/lib/briefs";
import { BriefArticle } from "@/components/brief/BriefArticle";

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const brief = getBriefBySlug(slug);
  if (!brief) notFound();

  const lang = locale === "ja" ? "ja" : "en";
  const body = lang === "ja" ? brief.bodyJa : brief.bodyEn;

  return (
    <BriefArticle
      metadata={brief.metadata}
      body={body}
      pdfPath={brief.pdfPath}
      lang={lang}
    />
  );
}
