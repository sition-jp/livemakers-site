import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LatestArticlesRailLayout } from "@/components/articles/LatestArticlesRailLayout";
import { ArticleRow } from "@/components/home/ArticleRow";
import { Link } from "@/i18n/navigation";
import {
  SERIES_SLUGS,
  type SeriesSlug,
} from "@/lib/articles/article-model";
import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { loadLatestArticlesRail } from "@/lib/articles/latest-articles-rail";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadEffectiveSurfacePublished } from "@/lib/future-atlas/surface";

export const revalidate = 300;

export function generateStaticParams() {
  return SERIES_SLUGS.map((series) => ({ series }));
}

function isSeriesSlug(value: string): value is SeriesSlug {
  return SERIES_SLUGS.includes(value as SeriesSlug);
}

export default async function ArticleSeriesPage({
  params,
}: {
  params: Promise<{ locale: string; series: string }>;
}) {
  const { locale, series } = await params;
  setRequestLocale(locale);
  if (!isSeriesSlug(series)) {
    notFound();
  }

  const t = await getTranslations("articles");
  const futureAtlas = await loadFutureAtlas();
  const surfacePublished = await loadEffectiveSurfacePublished(futureAtlas);
  const catalog = await loadPublicArticleInflowCatalog();
  const articles = catalog.articles.filter(
    (article) => article.family === series,
  );
  const rail = await loadLatestArticlesRail(catalog.articles);

  return (
    <LatestArticlesRailLayout rail={rail}>
      <main className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">
          {t("seriesTitle")}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">
          {t(`family.${series}`)}
        </h1>
        {series === "future-map" && surfacePublished && (
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/future-atlas" className="underline underline-offset-4">
              {t("futureAtlasGuide")}
            </Link>
          </p>
        )}
        {series === "weekly-brief" && (
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/brief" className="underline underline-offset-4">
              {t("briefArchiveNote")}
            </Link>
          </p>
        )}
        <div className="mt-6 border-t border-border-primary">
          {articles.map((article) => (
            <ArticleRow
              key={article.articleId}
              article={article}
              familyLabel={t(`family.${article.family}`)}
            />
          ))}
        </div>
      </main>
    </LatestArticlesRailLayout>
  );
}
