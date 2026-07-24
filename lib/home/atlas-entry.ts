import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * 未来アトラス入口 (D4 / G44)。flag OFF は future-map series page への先行公開経路、
 * flag ON は /future-atlas 面へ切り替える。D3 の nav-model と同じ単一導出。
 */
export interface AtlasEntry {
  published: boolean;
  href: string;
  latest: ArticleMeta | null;
}

export function buildAtlasEntry(
  surfacePublished: boolean,
  latest: ArticleMeta | null,
): AtlasEntry {
  return {
    published: surfacePublished,
    href: surfacePublished ? "/future-atlas" : "/articles/series/future-map",
    latest,
  };
}
