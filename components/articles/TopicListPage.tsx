import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LatestArticlesRailLayout } from "@/components/articles/LatestArticlesRailLayout";
import { SeriesPagination } from "@/components/articles/SeriesPagination";
import { ArticleRow } from "@/components/home/ArticleRow";
import { Link } from "@/i18n/navigation";
import {
  fetchArticleRail,
  fetchArticleTopicIndex,
} from "@/lib/articles/article-inflow-v2";
import { formatDateHeading } from "@/lib/articles/date-heading";
import { loadLatestArticlesRail } from "@/lib/articles/latest-articles-rail";
import { groupByJstDate, paginateSeries } from "@/lib/articles/series-pagination";
import {
  isArticleTopic,
  topicPageHref,
} from "@/lib/articles/topics";
import { localeAlternates } from "@/lib/seo/locale-alternates";

/** 棚ページの metadata (1 ページ目と 2 ページ目以降で共用)。 */
export async function topicListMetadata({
  locale,
  topic,
  page,
}: {
  locale: string;
  topic: string;
  page: number;
}): Promise<Metadata> {
  if (!isArticleTopic(topic)) return {};
  const t = await getTranslations({ locale, namespace: "topics" });
  const tArticles = await getTranslations({ locale, namespace: "articles" });
  const label = t(`${topic}.title`);
  return {
    title:
      page === 1
        ? label
        : tArticles("seriesPagedTitle", { series: label, page: String(page) }),
    description: t(`${topic}.description`),
    alternates: localeAlternates(locale, topicPageHref(topic, page)),
  };
}

/**
 * 棚ページの本体 (1 ページ目 /topics/{topic} と 2 ページ目以降
 * /topics/{topic}/page/{n} で共用)。一覧は v2 の棚 (topics/<topic>.json) から読み、
 * v1 カタログは読まない。取れない・0 本のときは説明と案内だけで 200 (1 ページ目)。
 * 不明な棚・範囲外ページは notFound。
 */
export async function renderTopicListPage({
  locale,
  topic,
  page,
}: {
  locale: string;
  topic: string;
  page: number;
}) {
  setRequestLocale(locale);
  if (!isArticleTopic(topic)) {
    notFound();
  }

  const t = await getTranslations("topics");
  const tArticles = await getTranslations("articles");
  const index = await fetchArticleTopicIndex(topic);
  const articles = index?.articles ?? [];
  const current = paginateSeries(articles, page);
  if (!current) {
    notFound();
  }
  const rail = await loadLatestArticlesRail({
    locale,
    articles: (await fetchArticleRail())?.latest ?? [],
  });
  const latestYear = articles[0]?.publishedAtJst.slice(0, 4) ?? "";

  return (
    <LatestArticlesRailLayout rail={rail}>
      <main className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">
          {t(`${topic}.title`)}
        </h1>
        <p className="mt-4 text-sm text-text-secondary">{t(`${topic}.description`)}</p>
        <p className="mt-2 text-sm text-text-tertiary">{t(`${topic}.rule`)}</p>
        {current.totalPages > 1 && (
          <p
            data-testid="series-page-indicator"
            className="mt-2 font-mono text-[11px] text-text-tertiary"
          >
            {tArticles("pagination.pageOf", {
              page: current.page,
              total: current.totalPages,
            })}
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
                  familyLabel={tArticles(`family.${article.family}`)}
                />
              ))}
            </section>
          ))}
        </div>
        <SeriesPagination
          series={topic}
          page={current.page}
          totalPages={current.totalPages}
          hrefFor={(n) => topicPageHref(topic, n)}
          copy={{
            label: tArticles("pagination.label"),
            newer: tArticles("pagination.newer"),
            older: tArticles("pagination.older"),
          }}
        />
        <p className="mt-8 text-sm text-text-secondary">
          <Link
            href="/articles/series/weekly-brief"
            className="underline underline-offset-4"
          >
            {t("weeklyBriefNote")}
          </Link>
        </p>
      </main>
    </LatestArticlesRailLayout>
  );
}
