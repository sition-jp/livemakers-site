import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { VideoEmbed } from "@/components/articles/VideoEmbed";
import { X_HANDLE, YOUTUBE_CHANNEL_URL } from "@/lib/site";
import {
  formatDurationJa,
  groupSourcesByChapter,
  timestampToSeconds,
  youtubeWatchUrl,
  type Video,
} from "@/lib/videos";

const mdxOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
  },
};

function hostname(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

/**
 * 動画の記事: 動画 (投稿前はアイキャッチと「近日公開」) → 本文 (要点) →
 * チャプター → 出典の全件 (章ごと)。
 *
 * `youtubeVideoId` が入ると、上部が埋め込みに替わり、チャプターの時刻が
 * YouTube の該当時刻へのリンクになる。
 */
export function VideoArticle({ video }: { video: Video }) {
  const t = useTranslations("videos");
  const groups = groupSourcesByChapter(video);
  const accessedDates = [...new Set(video.sources.map((source) => source.accessed))];
  const singleAccessed = accessedDates.length === 1 ? accessedDates[0] : null;
  let sourceNumber = 0;

  return (
    <article className="mx-auto max-w-4xl px-6 py-16" data-video-article={video.slug}>
      <header className="mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] tracking-label text-text-tertiary">
          <Link href="/videos" className="hover:text-text-primary">
            {t("title")}
          </Link>
          <span>{t("episodeLabel", { number: String(video.episodeNumber) })}</span>
          <span>{formatDurationJa(video.durationSeconds)}</span>
          <span>{t("asOf", { date: video.asOfDate })}</span>
        </div>
        <h1 className="mb-4 text-3xl font-light leading-snug tracking-title sm:text-4xl md:text-5xl md:leading-[1.35]">
          {video.titleJa}
        </h1>
        {video.subtitleJa ? (
          <p className="text-lg leading-relaxed text-text-secondary">{video.subtitleJa}</p>
        ) : null}
      </header>

      {video.youtubeVideoId ? (
        <div className="mb-10">
          <VideoEmbed id={video.youtubeVideoId} />
          <p className="mt-2 text-center text-xs">
            <a
              href={youtubeWatchUrl(video.youtubeVideoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pillar-overview hover:underline"
            >
              {t("watchOnYoutube")}
            </a>
          </p>
        </div>
      ) : (
        <div className="mb-10" data-video-status="coming-soon">
          {video.eyecatch ? (
            <div className="mb-4 aspect-[16/9] overflow-hidden">
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
          <p className="border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
            {t("comingSoonBody")}{" "}
            <a
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pillar-overview hover:underline"
            >
              {t("channelLink", { handle: X_HANDLE })}
            </a>
          </p>
        </div>
      )}

      {/* Prose colors come from the theme tokens in globals.css (BriefArticle と同じ) */}
      <div className="prose max-w-none prose-headings:font-light prose-headings:tracking-title prose-a:text-pillar-overview">
        <MDXRemote source={video.bodyJa} options={mdxOptions} />
      </div>

      <section className="mt-14" aria-labelledby="video-chapters">
        <h2 id="video-chapters" className="mb-6 text-2xl font-light tracking-title">
          {t("chaptersHeading")}
        </h2>
        <ol className="space-y-6">
          {video.chapters.map((chapter, index) => {
            const seconds = timestampToSeconds(chapter.start);
            return (
              <li key={chapter.start} data-video-chapter={chapter.start}>
                <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                  {video.youtubeVideoId ? (
                    <a
                      href={youtubeWatchUrl(video.youtubeVideoId, seconds)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-pillar-overview hover:underline"
                    >
                      {chapter.start}
                    </a>
                  ) : (
                    <span className="font-mono text-sm text-text-tertiary">{chapter.start}</span>
                  )}
                  <span className="text-xs tracking-label text-text-tertiary">
                    {t("chapterLabel", { number: String(index + 1) })}
                  </span>
                  <h3 className="text-base font-bold text-text-primary">{chapter.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">{chapter.summaryJa}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-14" aria-labelledby="video-sources" data-video-sources={video.sources.length}>
        <h2 id="video-sources" className="mb-3 text-2xl font-light tracking-title">
          {t("sourcesHeading", { count: String(video.sources.length) })}
        </h2>
        <p className="mb-8 text-sm text-text-secondary">
          {singleAccessed
            ? t("sourcesNoteWithDate", { date: singleAccessed })
            : t("sourcesNote")}
        </p>
        {groups.map((group) => {
          const start = sourceNumber + 1;
          sourceNumber += group.sources.length;
          return (
            <div key={group.number} className="mb-8">
              <h3 className="mb-3 text-sm font-bold text-text-primary">
                {t("chapterLabel", { number: String(group.number) })} {group.chapter.title}
              </h3>
              <ol start={start} className="list-decimal space-y-2 pl-8 text-sm marker:text-text-tertiary">
                {group.sources.map((source) => (
                  <li key={source.key} data-video-source={source.key}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-primary hover:text-pillar-overview hover:underline"
                    >
                      {source.title}
                    </a>
                    <span className="ml-2 text-xs text-text-tertiary">
                      {hostname(source.url)}
                      {singleAccessed ? null : ` · ${t("accessed", { date: source.accessed })}`}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </section>

      <p className="mt-14 text-sm">
        <Link href="/videos" className="text-pillar-overview hover:underline">
          {t("backToList")}
        </Link>
      </p>
    </article>
  );
}
