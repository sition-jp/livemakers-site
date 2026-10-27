import "server-only";

import { toJstParts } from "@/lib/articles/article-inflow-contract";
import {
  fetchArticleFamilyIndex,
  fetchArticleRail,
  type ArticleFamilyIndex,
} from "@/lib/articles/article-inflow-v2";
import {
  ARTICLE_FAMILIES,
  getAllArticles,
  type ArticleFamily,
  type ArticleMeta,
} from "@/lib/articles/article-model";
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

export async function loadArticleDetailContext(
  article: ArticleMeta,
  config: Parameters<typeof effectiveSurfacePublished>[0],
): Promise<ArticleDetailContext> {
  const [rail, familyIndex] = await Promise.all([
    fetchArticleRail(),
    isFamily(article.family) ? fetchArticleFamilyIndex(article.family) : Promise.resolve(null),
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

  const inflowRail = rail
    ? withoutDuplicates([...rail.latest, ...Object.values(rail.byFamily).flat()])
    : [];
  const railArticles = withoutDuplicates([...repository, ...inflowRail]).toSorted((left, right) =>
    right.publishedAtJst.localeCompare(left.publishedAtJst),
  );

  return {
    neighbors,
    related: rail ? getRelatedArticles(railArticles, article) : [],
    railArticles,
    surfacePublished: effectiveSurfacePublished(config, inflowRail),
  };
}
