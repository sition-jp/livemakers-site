import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { serialize } from "next-mdx-remote/serialize";
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

  const bodyEnSerialized = await serialize(brief.bodyEn);
  const bodyJaSerialized = await serialize(brief.bodyJa);

  return (
    <BriefArticle
      metadata={brief.metadata}
      bodyEnSerialized={bodyEnSerialized}
      bodyJaSerialized={bodyJaSerialized}
      pdfPath={brief.pdfPath}
      initialLang={locale === "ja" ? "ja" : "en"}
    />
  );
}
