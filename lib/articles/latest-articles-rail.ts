import { getTranslations } from "next-intl/server";

import type { LatestArticlesCopy } from "@/components/home/LatestArticlesCard";
import {
  ARTICLE_FAMILIES,
  type ArticleFamily,
  type ArticleMeta,
} from "@/lib/articles/article-model";
import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { selectLatestArticles } from "@/lib/articles/latest-articles";
import { resolveTodayJst } from "@/lib/home/resolve-today";

export interface LatestArticlesRailData {
  articles: ArticleMeta[];
  copy: LatestArticlesCopy;
}

/**
 * 一覧ページ右レール「最新の記事」のデータ (2026-10-02 田平氏指示)。
 * ホーム右カラム⑤と同じ 20 本・同じ見出し・同じ lanes タグ。選定は
 * selectLatestArticles に一本化し、記事の時計は実 JST 今日 (ホームと同じ)。
 * catalog を既に読んだページは articles を渡す (二重 fetch を避ける)。
 */
export async function loadLatestArticlesRail({
  locale,
  articles,
}: {
  locale: string;
  articles?: readonly ArticleMeta[];
}): Promise<LatestArticlesRailData> {
  const catalogArticles =
    articles ?? (await loadPublicArticleInflowCatalog()).articles;
  const tHome = await getTranslations({ locale, namespace: "home" });
  const tArticles = await getTranslations({ locale, namespace: "articles" });
  const familyLabels = Object.fromEntries(
    ARTICLE_FAMILIES.map((family) => [family, tArticles(`family.${family}`)]),
  ) as Record<ArticleFamily, string>;

  return {
    articles: selectLatestArticles(
      catalogArticles,
      resolveTodayJst(new Date()),
    ),
    copy: {
      title: tHome("gradient.latestTitle"),
      familyLabels,
      laneLabels: {
        macro: tHome("lanes.macro"),
        crypto: tHome("lanes.crypto"),
        rwa: tHome("lanes.rwa"),
      },
    },
  };
}
