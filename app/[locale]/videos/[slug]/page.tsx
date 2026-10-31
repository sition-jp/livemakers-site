import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SeriesRail } from "@/components/articles/SeriesRail";
import { VideoJsonLd } from "@/components/seo/VideoJsonLd";
import { VideoArticle } from "@/components/videos/VideoArticle";
import { loadRailContext } from "@/lib/articles/article-detail-context";
import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { isArticleInflowV2Enabled } from "@/lib/articles/article-inflow-v2";
import { loadSeriesRailCopy } from "@/lib/articles/series-rail-copy";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadEffectiveSurfacePublished } from "@/lib/future-atlas/surface";
import { localeAlternates } from "@/lib/seo/locale-alternates";
import { videoSlugParams } from "@/lib/static-params";
import { getLatestPostedVideo, getPostedVideoCards, getVideoBySlug } from "@/lib/videos";

// ISR cost doctrine (2026-08-01): prerender every video at build;
// unknown slugs 404 statically without invoking a function.
export const dynamicParams = false;
// 右レール (記事詳細と同じ SeriesRail・2026-10-31 田平氏 GO) を記事詳細と同じ間隔で新しくする
export const revalidate = 3600;

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

  // 右レールの記事: 記事詳細と同じ取り方 (v2 = rail + リポジトリ / v1 = カタログ)
  const futureAtlas = await loadFutureAtlas();
  const { railArticles, surfacePublished } = isArticleInflowV2Enabled()
    ? await loadRailContext(futureAtlas.config)
    : {
        railArticles: (await loadPublicArticleInflowCatalog()).articles,
        surfacePublished: await loadEffectiveSurfacePublished(futureAtlas),
      };
  const tVideos = await getTranslations("videos");
  // いま見ている回は「最新の動画」の窓にも「最新の記事」の行にも出さない
  const latestVideo = getLatestPostedVideo();
  const otherLatestVideo = latestVideo && latestVideo.slug !== video.slug ? latestVideo : null;

  return (
    <div
      data-video-layout=""
      className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8"
    >
      <VideoJsonLd video={video} lang={locale === "en" ? "en" : "ja"} />
      <VideoArticle video={video} />
      <SeriesRail
        articles={railArticles}
        current={null}
        surfacePublished={surfacePublished}
        copy={await loadSeriesRailCopy()}
        latestVideo={
          otherLatestVideo
            ? {
                video: otherLatestVideo,
                heading: tVideos("railLatestHeading"),
                watchLabel: tVideos("railWatch"),
              }
            : null
        }
        latestVideoRows={{
          items: getPostedVideoCards().filter((candidate) => candidate.slug !== video.slug),
          label: tVideos("rowLabel"),
        }}
      />
    </div>
  );
}
