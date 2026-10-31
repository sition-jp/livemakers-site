import type { ArticleFamily, ArticleLane } from "@/lib/articles/article-model";
import type { LatestEntry } from "@/lib/articles/latest-articles";
import { VideoRow } from "@/components/videos/VideoRow";
import { ArticleRow } from "./ArticleRow";

/**
 * 「最新の記事」の行 (記事 + 動画の記事)。ホーム右列⑤・一覧ページの右レール・
 * 記事詳細の右レールで共用する。どの行も索引扱い (data-index-nav)。
 */
export function LatestEntryRows({
  entries,
  familyLabels,
  laneLabels,
  videoLabel,
}: {
  entries: readonly LatestEntry[];
  familyLabels: Record<ArticleFamily, string>;
  laneLabels?: Record<ArticleLane, string>;
  videoLabel: string;
}) {
  return entries.map((entry) =>
    entry.kind === "article" ? (
      <ArticleRow
        key={entry.article.articleId}
        article={entry.article}
        familyLabel={familyLabels[entry.article.family]}
        laneLabels={laneLabels}
        indexNav
      />
    ) : (
      <VideoRow
        key={`video-${entry.video.slug}`}
        video={{ ...entry.video, publishedAtJst: entry.publishedAtJst }}
        label={videoLabel}
      />
    ),
  );
}
