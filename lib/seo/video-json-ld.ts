import { SITE_LOGO_HEIGHT, SITE_LOGO_URL, SITE_LOGO_WIDTH, SITE_NAME, SITE_URL } from "@/lib/site";
import { timestampToSeconds, youtubeWatchUrl, type Video } from "@/lib/videos";

/** 秒数を ISO 8601 の長さ (`PT38M23S`) にする */
function isoDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${seconds || totalSeconds === 0 ? `${seconds}S` : ""}`;
}

/**
 * 動画の記事 (`/videos/<slug>`) の `VideoObject` JSON-LD。
 *
 * YouTube に上がった回 (`youtubeVideoId` と `publishedAtJst` の両方がある回)
 * だけに出す — `uploadDate` は必須項目で、投稿前の回に推測の日時を書かないため。
 * チャプターは `Clip` にし、検索結果で「重要なシーン」として時刻へ飛べるようにする。
 * 各 Clip の終わりは次のチャプターの始まり、最後のチャプターは動画の長さ。
 */
export function buildVideoJsonLd(video: Video, lang: "ja" | "en") {
  const { youtubeVideoId, publishedAtJst } = video;
  if (!youtubeVideoId || !publishedAtJst) return null;

  const starts = video.chapters.map((chapter) => timestampToSeconds(chapter.start));
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.subtitleJa ? `${video.titleJa}｜${video.subtitleJa}` : video.titleJa,
    description: video.excerptJa,
    uploadDate: publishedAtJst,
    duration: isoDuration(video.durationSeconds),
    thumbnailUrl: [
      ...(video.eyecatch ? [`${SITE_URL}${video.eyecatch.src}`] : []),
      `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
    ],
    embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeVideoId}`,
    url: youtubeWatchUrl(youtubeVideoId),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/${lang}${video.href}` },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: SITE_LOGO_URL,
        width: SITE_LOGO_WIDTH,
        height: SITE_LOGO_HEIGHT,
      },
    },
    inLanguage: "ja",
    isAccessibleForFree: true,
    hasPart: video.chapters.map((chapter, index) => ({
      "@type": "Clip",
      name: chapter.title,
      startOffset: starts[index],
      endOffset: starts[index + 1] ?? video.durationSeconds,
      url: youtubeWatchUrl(youtubeVideoId, starts[index]),
    })),
  };
}
