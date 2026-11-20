import "server-only";

import { toJstParts } from "@/lib/articles/article-inflow-contract";
import {
  fetchArticleFamilyIndex,
  fetchArticleRail,
  fetchArticleTopicIndex,
  type ArticleFamilyIndex,
} from "@/lib/articles/article-inflow-v2";
import {
  ARTICLE_FAMILIES,
  getAllArticles,
  type ArticleFamily,
  type ArticleMeta,
} from "@/lib/articles/article-model";
import type { ArticleTopic } from "@/lib/articles/topics";
import { getRelatedArticles, getSeriesNeighbors } from "@/lib/articles/related";
import { effectiveSurfacePublished } from "@/lib/future-atlas/load";

/**
 * 段 2a (2026-10-27): 記事ページの「なくても描ける」部分を v2 から組む。
 *
 * - 前後リンク: シリーズごとの一覧 (`families/<family>.json`) + リポジトリの同じシリーズ
 * - 関連記事・シリーズ欄: rail (`rail.json` の新しい 20 本 + シリーズごとの 6 本) + リポジトリ
 * - 未来アトラスの表示判定: rail に future-atlas の記事があるか
 *
 * どれかが取れなければ、その部分を空にして返す (投げない) — 記事ページは
 * 記事の記録さえ読めれば 200 で描く。
 */

export type ArticleDetailContext = {
  neighbors: { prev: ArticleMeta | null; next: ArticleMeta | null };
  related: ArticleMeta[];
  railArticles: ArticleMeta[];
  surfacePublished: boolean;
  // 記事が入っている棚 (一覧が取れなければ [])
  topics: ArticleTopic[];
};

function repositoryArticles(): ArticleMeta[] {
  return getAllArticles().map((article) => ({ ...article, href: `/articles/${article.articleId}` }));
}

function isFamily(value: string): value is ArticleFamily {
  return (ARTICLE_FAMILIES as readonly string[]).includes(value);
}

/** 前後リンクに使う最小の形 (ArticlePrevNext が使うのは href と titleJa)。 */
function familyItemsToMeta(index: ArticleFamilyIndex, family: ArticleFamily): ArticleMeta[] {
  return index.items.map((item) => {
    const jst = toJstParts(item.publishedAt);
    return {
      articleId: item.slug,
      family,
      titleJa: item.title,
      publishedAtJst: jst.iso,
      publishedLabel: `${jst.date.slice(5)} ${jst.time} 公開`,
      lanes: [],
      href: `/articles/${item.slug}`,
    };
  });
}

function withoutDuplicates(articles: ArticleMeta[]): ArticleMeta[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.articleId)) return false;
    seen.add(article.articleId);
    return true;
  });
}

export type ArticleDetailFrame = Pick<ArticleDetailContext, "neighbors" | "topics">;

/**
 * 記事ページの HTML に焼く部分だけ (2026-11-20・Vercel ISR Writes 削減):
 * 前後リンクと棚の印。どちらも新しい記事が出ても、その記事のシリーズの直前の
 * 1 本 (次の記事へのリンクが付く) 以外は変わらない。右レーンと関連記事は
 * 新しい記事が出るたびに全記事ページで変わるので、ブラウザが /api/article-rail
 * から読む (components/articles/ArticleRailClient.tsx)。
 */
export async function loadArticleDetailFrame(article: ArticleMeta): Promise<ArticleDetailFrame> {
  const [familyIndex, fundingIndex] = await Promise.all([
    isFamily(article.family) ? fetchArticleFamilyIndex(article.family) : Promise.resolve(null),
    fetchArticleTopicIndex("funding"),
  ]);
  const repository = repositoryArticles();
  const neighbors = familyIndex
    ? getSeriesNeighbors(
        withoutDuplicates([
          ...repository.filter((candidate) => candidate.family === article.family),
          ...familyItemsToMeta(familyIndex, article.family),
        ]),
        article,
      )
    : { prev: null, next: null };
  return {
    neighbors,
    topics: fundingIndex?.articles.some((entry) => entry.articleId === article.articleId)
      ? ["funding"]
      : [],
  };
}

/** 前後リンク・棚の印に、右レーンと関連記事を足した全部 (テストと移行前の形)。 */
export async function loadArticleDetailContext(
  article: ArticleMeta,
  config: Parameters<typeof effectiveSurfacePublished>[0],
): Promise<ArticleDetailContext> {
  const [frame, rail] = await Promise.all([loadArticleDetailFrame(article), fetchArticleRail()]);
  const { railArticles, surfacePublished } = railContextFrom(rail, repositoryArticles(), config);
  return {
    ...frame,
    related: rail ? getRelatedArticles(railArticles, article) : [],
    railArticles,
    surfacePublished,
  };
}

type RailContext = Pick<ArticleDetailContext, "railArticles" | "surfacePublished">;

function railContextFrom(
  rail: Awaited<ReturnType<typeof fetchArticleRail>>,
  repository: ArticleMeta[],
  config: Parameters<typeof effectiveSurfacePublished>[0],
): RailContext {
  const inflowRail = rail
    ? withoutDuplicates([...rail.latest, ...Object.values(rail.byFamily).flat()])
    : [];
  return {
    railArticles: withoutDuplicates([...repository, ...inflowRail]).toSorted((left, right) =>
      right.publishedAtJst.localeCompare(left.publishedAtJst),
    ),
    surfacePublished: effectiveSurfacePublished(config, inflowRail),
  };
}

/**
 * 記事でないページ (動画の記事・2026-10-31) の右レール用: 記事詳細と同じ rail +
 * リポジトリの記事と、未来アトラスの表示判定だけを組む。rail が取れなければ
 * リポジトリの記事だけで描く (投げない)。
 */
export async function loadRailContext(
  config: Parameters<typeof effectiveSurfacePublished>[0],
): Promise<RailContext> {
  return railContextFrom(await fetchArticleRail(), repositoryArticles(), config);
}
