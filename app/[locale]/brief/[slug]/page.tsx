import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getBriefBySlug } from "@/lib/briefs";
import {
  pickBriefImage,
  stripMarkdown,
  truncate,
} from "@/lib/brief-metadata";
import { BriefArticle } from "@/components/brief/BriefArticle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const brief = getBriefBySlug(slug);
  if (!brief) return {};

  const lang: "ja" | "en" = locale === "ja" ? "ja" : "en";
  const title = lang === "ja" ? brief.metadata.title_ja : brief.metadata.title_en;
  const summarySource =
    lang === "ja"
      ? brief.metadata.executive_summary_ja
      : brief.metadata.executive_summary_en;
  // JA description targets 180 chars (Twitter Card recommendation),
  // EN description targets 200 chars (Twitter accepts up to ~200 well).
  const descriptionMax = lang === "ja" ? 180 : 200;
  const description = truncate(stripMarkdown(summarySource), descriptionMax);

  const imagePath = pickBriefImage(slug, lang);
  const fullTitle = `${title} — LiveMakers Weekly Brief`;

  const og: Metadata["openGraph"] = {
    title,
    description,
    type: "article",
    locale: lang === "ja" ? "ja_JP" : "en_US",
    siteName: "LiveMakers",
    publishedTime: brief.metadata.published_at,
    tags: brief.metadata.tags,
  };

  const twitter: Metadata["twitter"] = {
    card: "summary_large_image",
    title,
    description,
  };

  if (imagePath) {
    og.images = [
      { url: imagePath, width: 1200, height: 675, alt: title },
    ];
    twitter.images = [imagePath];
  }

  return {
    title: fullTitle,
    description,
    openGraph: og,
    twitter,
  };
}

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
