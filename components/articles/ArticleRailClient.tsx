"use client";

import { useEffect, useState } from "react";

import { RelatedArticles } from "@/components/articles/RelatedArticles";
import { SeriesRail, type SeriesRailCopy } from "@/components/articles/SeriesRail";
import type { LatestVideoRows } from "@/components/home/LatestArticlesCard";
import type { VideoRailCardProps } from "@/components/videos/VideoRailCard";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { isArticleRailFeed, type ArticleRailFeed } from "@/lib/articles/article-rail-feed";
import { getRelatedArticles } from "@/lib/articles/related";

export const ARTICLE_RAIL_ENDPOINT = "/api/article-rail";

/**
 * 記事ページの右レーンと関連記事をブラウザで読み込む (2026-11-20・Vercel ISR
 * Writes 削減)。記事ページの HTML には枠だけを出し、中身は /api/article-rail から
 * 組む。2 つの部品で 1 回だけ取りに行く (同じ promise を共有)。取得に失敗したら
 * 枠は空のまま (本文の表示は止めない)。
 */
let pending: Promise<ArticleRailFeed | null> | null = null;

function loadFeed(): Promise<ArticleRailFeed | null> {
  pending ??= fetch(ARTICLE_RAIL_ENDPOINT)
    .then((response) => (response.ok ? response.json() : null))
    .then((feed: unknown) => (isArticleRailFeed(feed) ? feed : null))
    .catch(() => null)
    .then((feed) => {
      // 失敗した回は次の画面遷移で取り直せるようにする
      if (!feed) pending = null;
      return feed;
    });
  return pending;
}

/** テスト用: 共有している取得結果を捨てる */
export function resetArticleRailFeedForTest(): void {
  pending = null;
}

export function useArticleRailFeed(): ArticleRailFeed | null {
  const [feed, setFeed] = useState<ArticleRailFeed | null>(null);
  useEffect(() => {
    let active = true;
    loadFeed().then((loaded) => {
      if (active) setFeed(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return feed;
}

export function ArticleSeriesRailClient({
  current,
  copy,
  relatedVideo = null,
  latestVideo = null,
  latestVideoRows = null,
}: {
  current: ArticleMeta;
  copy: SeriesRailCopy;
  relatedVideo?: Omit<VideoRailCardProps, "placement"> | null;
  latestVideo?: Omit<VideoRailCardProps, "placement"> | null;
  latestVideoRows?: LatestVideoRows | null;
}) {
  const feed = useArticleRailFeed();
  if (!feed) {
    // 2 段組みの右の列を先に確保しておく (読み込み後に本文の位置が動かない)
    return (
      <aside
        data-article-rail=""
        data-article-rail-pending=""
        aria-busy="true"
        aria-label={copy.railTitle}
        className="mt-12 min-w-0 border-t border-border-primary pt-6 lg:mt-0 lg:border-t-0 lg:pt-0"
      >
        <p className="mb-3 text-[11px] font-bold tracking-label text-text-tertiary">
          {copy.railTitle}
        </p>
      </aside>
    );
  }
  return (
    <SeriesRail
      articles={feed.articles}
      current={current}
      surfacePublished={feed.surfacePublished}
      copy={copy}
      relatedVideo={relatedVideo}
      latestVideo={latestVideo}
      latestVideoRows={latestVideoRows}
    />
  );
}

export function ArticleRelatedClient({
  current,
  title,
  familyLabels,
}: {
  current: ArticleMeta;
  title: string;
  familyLabels: Record<ArticleFamily, string>;
}) {
  const feed = useArticleRailFeed();
  if (!feed) return null;
  return (
    <RelatedArticles
      articles={getRelatedArticles(feed.articles, current)}
      title={title}
      familyLabels={familyLabels}
    />
  );
}
