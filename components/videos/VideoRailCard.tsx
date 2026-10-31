import { Link } from "@/i18n/navigation";
import { formatDurationJa, type VideoCardData } from "@/lib/videos";

export interface VideoRailCardProps {
  video: VideoCardData;
  heading: string;
  watchLabel: string;
  /** related = 記事の右レーン上「この記事の解説動画」/ latest = 「最新の動画」 */
  placement: "related" | "latest";
}

/**
 * トップ右列・記事の右レーンに置く動画の窓 (2026-10-31 田平氏 GO)。
 * YouTube は埋め込まない — 全ページで YouTube の読み込みが走ると重く、閲覧者の
 * 情報も送られるため。押すと動画の記事 (/videos/<slug>) へ飛び、再生はそこで行う。
 * 索引扱い (data-index-nav)。
 */
export function VideoRailCard({ video, heading, watchLabel, placement }: VideoRailCardProps) {
  return (
    <section
      data-video-rail={placement}
      data-index-nav=""
      className="rounded-lg border border-border-primary bg-bg-secondary p-3"
    >
      <h2 className="mb-2 text-xs font-bold text-text-primary">{heading}</h2>
      <Link href={video.href} className="group block">
        {video.eyecatch ? (
          <div className="aspect-[16/9] overflow-hidden rounded">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.eyecatch.src}
              alt={video.eyecatch.alt}
              width={video.eyecatch.width}
              height={video.eyecatch.height}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <p className="mt-2 text-sm font-bold leading-snug text-text-primary group-hover:text-accent">
          {video.titleJa}
        </p>
        {video.subtitleJa ? (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-text-secondary">
            {video.subtitleJa}
          </p>
        ) : null}
        <p className="mt-1.5 text-[11px] font-bold text-accent">
          ▶ {watchLabel}
          <span className="ml-2 font-normal text-text-tertiary">
            {formatDurationJa(video.durationSeconds)}
          </span>
        </p>
      </Link>
    </section>
  );
}
