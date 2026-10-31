import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { TagLabel } from "@/components/ui/TagLabel";
import { X_HANDLE, YOUTUBE_CHANNEL_URL } from "@/lib/site";
import { formatDurationJa, type Video } from "@/lib/videos";

/**
 * 動画の一覧 (YouTube チャンネル @LiveMakersCom)。新しい回が先。
 * カードは記事 (/videos/<slug>) へ飛ぶ。投稿前の回は「近日公開」を付ける。
 * 2026-10-31 田平氏 GO: シリーズ一覧と同じく右に「最新の記事」のレールを置く
 * (page 側の LatestArticlesRailLayout)。本体は左カラムの main。
 */
export function VideoList({ videos }: { videos: Video[] }) {
  const t = useTranslations("videos");

  return (
    <main className="min-w-0">
      <h1 className="mb-6 text-3xl font-bold text-text-primary">{t("title")}</h1>
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-text-secondary">{t("intro")}</p>
      <p className="mb-12 text-sm">
        <a
          href={YOUTUBE_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-pillar-overview hover:underline"
        >
          {t("channelLink", { handle: X_HANDLE })}
        </a>
      </p>

      {videos.length === 0 ? (
        <p className="text-sm text-text-tertiary">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {videos.map((video) => (
            <div
              key={video.slug}
              data-video-card={video.slug}
              className="flex flex-col overflow-hidden border border-border-primary bg-bg-secondary transition-colors hover:border-border-hover"
            >
              <Link href={video.href} data-video-card-link className="group block">
                {video.eyecatch ? (
                  <div className="aspect-[16/9] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={video.eyecatch.src}
                      alt={video.eyecatch.alt}
                      width={video.eyecatch.width}
                      height={video.eyecatch.height}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <TagLabel>{t("episodeLabel", { number: String(video.episodeNumber) })}</TagLabel>
                    {video.youtubeVideoId ? null : <TagLabel>{t("comingSoon")}</TagLabel>}
                  </div>
                  <h2 className="mb-2 text-lg font-bold leading-snug text-text-primary group-hover:text-pillar-overview">
                    {video.titleJa}
                  </h2>
                  {video.subtitleJa ? (
                    <p className="mb-3 text-sm leading-snug text-text-secondary">{video.subtitleJa}</p>
                  ) : null}
                  <p className="mb-4 line-clamp-3 text-sm text-text-secondary">{video.excerptJa}</p>
                  <div className="flex items-center justify-between text-[10px] tracking-label text-text-tertiary">
                    <span>{formatDurationJa(video.durationSeconds)}</span>
                    <span>{t("chapterCount", { count: String(video.chapters.length) })}</span>
                  </div>
                </div>
              </Link>
              {/* 関連記事はカードの記事リンクの外 (a の入れ子を避ける) */}
              {video.relatedArticles.length > 0 ? (
                <div className="border-t border-border-primary px-6 py-4" data-video-related>
                  <p className="mb-2 text-[10px] tracking-label text-text-tertiary">{t("relatedHeading")}</p>
                  <ul className="space-y-1.5 text-xs leading-snug">
                    {video.relatedArticles.map((article) => (
                      <li key={article.href}>
                        <Link href={article.href} className="text-text-secondary hover:text-pillar-overview hover:underline">
                          {article.titleJa}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
