import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LandmarkMeter } from "@/components/articles/LandmarkMeter";
import { LatestArticlesRailLayout } from "@/components/articles/LatestArticlesRailLayout";
import { SeriesPagination } from "@/components/articles/SeriesPagination";
import { ArticleRow } from "@/components/home/ArticleRow";
import { Link } from "@/i18n/navigation";
import {
  SERIES_SLUGS,
  type SeriesSlug,
} from "@/lib/articles/article-model";
import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { formatDateHeading } from "@/lib/articles/date-heading";
import { loadLatestArticlesRail } from "@/lib/articles/latest-articles-rail";
import {
  groupByJstDate,
  paginateSeries,
  seriesPageHref,
} from "@/lib/articles/series-pagination";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadEffectiveSurfacePublished } from "@/lib/future-atlas/surface";
import { buildLandmarkRows } from "@/lib/landmark/meter-model";
import { localeAlternates } from "@/lib/seo/locale-alternates";
import { fetchLiveMarketData } from "@/lib/terminal/live-market-feed";

function isSeriesSlug(value: string): value is SeriesSlug {
  return SERIES_SLUGS.includes(value as SeriesSlug);
}

/** シリーズ一覧の metadata (1 ページ目と 2 ページ目以降で共用)。 */
export async function seriesListMetadata({
  locale,
  series,
  page,
}: {
  locale: string;
  series: string;
  page: number;
}): Promise<Metadata> {
  if (!isSeriesSlug(series)) return {};
  const t = await getTranslations({ locale, namespace: "articles" });
  const label = t(`family.${series}`);
  return {
    title: page === 1 ? label : t("seriesPagedTitle", { series: label, page: String(page) }),
    alternates: localeAlternates(locale, seriesPageHref(series, page)),
  };
}

/**
 * シリーズ一覧の本体 (1 ページ目 /articles/series/{series} と
 * 2 ページ目以降 /articles/series/{series}/page/{n} で共用)。
 * 不明シリーズ・範囲外ページは notFound。
 */
export async function renderSeriesListPage({
  locale,
  series,
  page,
}: {
  locale: string;
  series: string;
  page: number;
}) {
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
  const current = paginateSeries(articles, page);
  if (!current) {
    notFound();
  }
  const rail = await loadLatestArticlesRail({
    locale,
    articles: catalog.articles,
  });
  const latestYear = articles[0]?.publishedAtJst.slice(0, 4) ?? "";
  // 節目の計器盤 (core spec 2026-10-16-lvm-landmark-meter-design): 日本語の 1 ページ目だけ。
  // feed に landmark が無い・全行が古いときは出さない (いまのページのまま)
  const landmarkRows =
    series === "landmark" && locale === "ja" && current.page === 1
      ? buildLandmarkRows((await fetchLiveMarketData())?.landmark ?? null, new Date())
      : null;
  const meterT = landmarkRows ? await getTranslations("articles.landmarkMeter") : null;

  return (
    <LatestArticlesRailLayout rail={rail}>
      <main className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">
          {t("seriesTitle")}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">
          {t(`family.${series}`)}
        </h1>
        {current.totalPages > 1 && (
          <p
            data-testid="series-page-indicator"
            className="mt-2 font-mono text-[11px] text-text-tertiary"
          >
            {t("pagination.pageOf", {
              page: current.page,
              total: current.totalPages,
            })}
          </p>
        )}
        {series === "future-map" && surfacePublished && (
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/future-atlas" className="underline underline-offset-4">
              {t("futureAtlasGuide")}
            </Link>
          </p>
        )}
        {landmarkRows && meterT && <LandmarkMeter rows={landmarkRows} t={meterT} />}
        {series === "weekly-brief" && (
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/brief" className="underline underline-offset-4">
              {t("briefArchiveNote")}
            </Link>
          </p>
        )}
        <div className="mt-6">
          {groupByJstDate(current.items).map((group) => (
            <section key={group.date} data-series-date={group.date}>
              <h2 className="border-b border-border-primary px-3 pb-1.5 pt-5 font-mono text-[11px] font-bold tracking-label text-text-secondary">
                <time dateTime={group.date}>
                  {formatDateHeading(group.date, locale, latestYear)}
                </time>
              </h2>
              {group.items.map((article) => (
                <ArticleRow
                  key={article.articleId}
                  article={article}
                  familyLabel={t(`family.${article.family}`)}
                />
              ))}
            </section>
          ))}
        </div>
        <SeriesPagination
          series={series}
          page={current.page}
          totalPages={current.totalPages}
          copy={{
            label: t("pagination.label"),
            newer: t("pagination.newer"),
            older: t("pagination.older"),
          }}
        />
      </main>
    </LatestArticlesRailLayout>
  );
}
