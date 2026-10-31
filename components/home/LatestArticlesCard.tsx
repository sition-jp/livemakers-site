import type {
  ArticleFamily,
  ArticleLane,
  ArticleMeta,
} from "@/lib/articles/article-model";
import { mergeLatestEntries } from "@/lib/articles/latest-articles";
import type { VideoCardData } from "@/lib/videos";
import { LatestEntryRows } from "./LatestEntryRows";

export interface LatestArticlesCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
  laneLabels: Record<ArticleLane, string>;
}

/** 「最新の記事」に混ぜる動画と、その行のラベル (「動画」) */
export interface LatestVideoRows {
  items: readonly VideoCardData[];
  label: string;
}

/**
 * 右カラム⑤ 最新記事 10 本 (G44 D7)。全 family を更新順に並べる索引モジュール。
 * latest-articles は INDEX_NAV_MODULES なので全行を indexNav (data-index-nav) で
 * 索引扱いにし、本体の重複検査 (gate 6) から除外する。lanes タグ付き。
 * 2026-10-31 田平氏 GO: YouTube に上がった動画の記事も公開日時で混ぜる (サムネなし)。
 */
export function LatestArticlesCard({
  articles,
  copy,
  videos = null,
}: {
  articles: ArticleMeta[];
  copy: LatestArticlesCopy;
  videos?: LatestVideoRows | null;
}) {
  const entries = mergeLatestEntries(articles, videos?.items ?? [], Math.max(articles.length, 1));
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <div className="mt-2 border-t border-border-primary">
        <LatestEntryRows
          entries={entries}
          familyLabels={copy.familyLabels}
          laneLabels={copy.laneLabels}
          videoLabel={videos?.label ?? ""}
        />
      </div>
    </section>
  );
}
