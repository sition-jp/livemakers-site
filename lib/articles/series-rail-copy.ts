import { getTranslations } from "next-intl/server";

import type { SeriesRailCopy } from "@/components/articles/SeriesRail";
import { ARTICLE_FAMILIES, type ArticleFamily } from "@/lib/articles/article-model";

/** 記事詳細と動画の記事で共用する右レール (SeriesRail) の文言 */
export async function loadSeriesRailCopy(): Promise<SeriesRailCopy> {
  const t = await getTranslations("articles");
  return {
    railTitle: t("detail.railTitle"),
    currentSeriesTitle: t("detail.currentSeriesTitle"),
    viewAll: t("detail.viewAll"),
    sessionTerminalHeading: t("detail.sessionTerminalHeading"),
    sessionTerminalEntry: t("detail.sessionTerminalEntry"),
    latestArticlesHeading: t("detail.latestArticlesHeading"),
    atlasPublishedHeading: t("detail.atlasPublishedHeading"),
    atlasUnpublishedHeading: t("detail.atlasUnpublishedHeading"),
    familyLabels: Object.fromEntries(
      ARTICLE_FAMILIES.map((family) => [family, t(`family.${family}`)]),
    ) as Record<ArticleFamily, string>,
  };
}
