import { Link } from "@/i18n/navigation";
import type { VideoCardData } from "@/lib/videos";

/**
 * 「最新の記事」のリストに混ぜる動画の行 (2026-10-31 田平氏 GO)。ArticleRow と
 * 同じレイアウト B・サムネなし。押すと自社の動画の記事 (/videos/<slug>) へ飛ぶ。
 * 索引の行なので data-index-nav を付ける。日時の書き方は記事の publishedLabel と同じ。
 */
export function VideoRow({
  video,
  label,
}: {
  video: VideoCardData & { publishedAtJst: string };
  label: string;
}) {
  const at = video.publishedAtJst;
  return (
    <Link
      href={video.href}
      data-video-row={video.slug}
      data-index-nav=""
      className="group block border-b border-border-primary px-3 py-2.5 text-left transition-colors hover:bg-bg-tertiary"
    >
      <span
        data-testid="article-row-title"
        className="block text-sm font-semibold text-text-primary group-hover:underline"
      >
        🎬 {video.titleJa}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-2">
        <span
          data-testid="article-row-chip"
          className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-label"
          style={{
            borderColor: "var(--lmk-family-video)",
            color: "var(--lmk-family-video)",
          }}
        >
          {label}
        </span>
        <time dateTime={at} className="whitespace-nowrap font-mono text-[10px] text-text-tertiary">
          {`${at.slice(5, 10)} ${at.slice(11, 16)} 公開`}
        </time>
      </span>
    </Link>
  );
}
