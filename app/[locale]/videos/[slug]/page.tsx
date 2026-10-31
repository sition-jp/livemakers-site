import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { VideoJsonLd } from "@/components/seo/VideoJsonLd";
import { VideoArticle } from "@/components/videos/VideoArticle";
import { localeAlternates } from "@/lib/seo/locale-alternates";
import { videoSlugParams } from "@/lib/static-params";
import { getVideoBySlug } from "@/lib/videos";

// ISR cost doctrine (2026-08-01): prerender every video at build;
// unknown slugs 404 statically without invoking a function.
export const dynamicParams = false;

export function generateStaticParams() {
  return videoSlugParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const video = getVideoBySlug(slug);
  if (!video) return {};

  const title = video.subtitleJa ? `${video.titleJa}｜${video.subtitleJa}` : video.titleJa;
  const images = video.eyecatch
    ? [
        {
          url: video.eyecatch.src,
          width: video.eyecatch.width,
          height: video.eyecatch.height,
          alt: video.eyecatch.alt,
        },
      ]
    : undefined;

  return {
    title,
    description: video.excerptJa,
    alternates: localeAlternates(locale, video.href),
    openGraph: {
      title,
      description: video.excerptJa,
      type: "article",
      locale: "ja_JP",
      siteName: "LiveMakers",
      ...(video.publishedAtJst ? { publishedTime: video.publishedAtJst } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: video.excerptJa,
      ...(images ? { images: [images[0].url] } : {}),
    },
  };
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const video = getVideoBySlug(slug);
  if (!video) notFound();

  return (
    <>
      <VideoJsonLd video={video} lang={locale === "en" ? "en" : "ja"} />
      <VideoArticle video={video} />
    </>
  );
}
