import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LatestArticlesRailLayout } from "@/components/articles/LatestArticlesRailLayout";
import { SeriesPagination } from "@/components/articles/SeriesPagination";
import { SearchIcon } from "@/components/search/SearchIcon";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { Link } from "@/i18n/navigation";
import {
  ARTICLE_FAMILIES,
  SERIES_SLUGS,
  type ArticleFamily,
} from "@/lib/articles/article-model";
import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { formatDateHeading } from "@/lib/articles/date-heading";
import { loadLatestArticlesRail } from "@/lib/articles/latest-articles-rail";
import {
  groupByJstDate,
  paginateSeries,
  seriesPageHref,
} from "@/lib/articles/series-pagination";
import { resolveTodayJst } from "@/lib/home/resolve-today";
import {
  SEARCH_QUERY_MAX,
  parseSearchParams,
  searchHref,
  type RawSearchParams,
} from "@/lib/search/parse-query";
import {
  countByFamily,
  searchArticles,
  type SearchHit,
} from "@/lib/search/search-articles";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
};

/**
 * サイト内検索 第1段階 (2026-10-02 田平氏 GO・spec
 * sition-core 08_DOCS/knowledge/specs/2026-10-02-lvm-site-search-phase1-design.md)。
 * searchParams を読むので request 時の動的描画。catalog は fetch cache (3600) に
 * 載っているので毎回 Blob へは行かない。検索語は記録しない (プライバシーページ)。
 * noindex,follow・canonical は q なし。robots.ts の disallow には入れない
 * (Google に noindex を読ませるため)。
 */
export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const { q } = parseSearchParams(await searchParams);
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: q ? t("resultsHeading", { q }) : t("pageTitle"),
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/search` },
  };
}

function SeriesLinks({
  heading,
  labelOf,
}: {
  heading: string;
  labelOf: (family: ArticleFamily) => string;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] font-bold tracking-label text-text-secondary">
        {heading}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {SERIES_SLUGS.map((series) => (
          <li key={series}>
            <Link
              href={seriesPageHref(series, 1)}
              className="inline-block rounded-sm border border-border-primary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              {labelOf(series)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function SearchPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, terms, family, page } = parseSearchParams(await searchParams);

  const t = await getTranslations("search");
  const tArticles = await getTranslations("articles");
  const familyLabel = (value: ArticleFamily) => tArticles(`family.${value}`);
  const catalog = await loadPublicArticleInflowCatalog();
  const rail = await loadLatestArticlesRail({
    locale,
    articles: catalog.articles,
  });

  const allHits = searchArticles(
    catalog.articles,
    terms,
    resolveTodayJst(new Date()),
  );
  const counts = countByFamily(allHits);
  const hits = family
    ? allHits.filter((hit) => hit.article.family === family)
    : allHits;
  // 範囲外ページは 1 ページ目 (検索語を変えた直後に 404 を見せない)
  const current = paginateSeries(hits, page) ?? paginateSeries(hits, 1)!;
  const showTiers =
    hits.some((hit) => hit.titleMatch) && hits.some((hit) => !hit.titleMatch);
  const tiers: { key: "titleTier" | "otherTier"; items: SearchHit[] }[] = [
    { key: "titleTier", items: current.items.filter((hit) => hit.titleMatch) },
    { key: "otherTier", items: current.items.filter((hit) => !hit.titleMatch) },
  ];
  const latestYear = hits[0]?.article.publishedAtJst.slice(0, 4) ?? "";
  const tabClass =
    "rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors";

  return (
    <LatestArticlesRailLayout rail={rail}>
      <main className="min-w-0">
        <h1 className="text-2xl font-bold text-text-primary">
          {q ? t("resultsHeading", { q }) : t("pageTitle")}
        </h1>

        <form
          role="search"
          method="get"
          action={`/${locale}/search`}
          aria-label={t("label")}
          className="mt-4 flex items-center gap-2 border-b border-border-primary pb-2"
        >
          <SearchIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={SEARCH_QUERY_MAX}
            placeholder={t("placeholder")}
            aria-label={t("label")}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-sm border border-border-primary px-3 py-1 text-xs tracking-tabs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          >
            {t("submit")}
          </button>
        </form>

        {terms.length === 0 ? (
          <>
            <p className="mt-6 text-sm text-text-secondary">
              {t("promptHint")}
            </p>
            <SeriesLinks heading={t("seriesHeading")} labelOf={familyLabel} />
          </>
        ) : allHits.length === 0 ? (
          <>
            <p className="mt-6 text-sm text-text-primary">{t("empty", { q })}</p>
            <p className="mt-2 text-sm text-text-secondary">{t("emptyHint")}</p>
            <SeriesLinks heading={t("seriesHeading")} labelOf={familyLabel} />
          </>
        ) : (
          <>
            <p className="mt-4 font-mono text-[11px] text-text-tertiary">
              {t("count", { count: allHits.length })}
            </p>
            <nav
              aria-label={t("familyFilterLabel")}
              className="mt-3 flex flex-wrap gap-2"
            >
              {[null, ...ARTICLE_FAMILIES.filter((value) => counts[value])].map(
                (value) => {
                  const active = value === family;
                  return (
                    <Link
                      key={value ?? "all"}
                      href={searchHref({ q, family: value })}
                      aria-current={active ? "page" : undefined}
                      className={`${tabClass} ${
                        active
                          ? "border-text-primary font-bold text-text-primary"
                          : "border-border-primary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                      }`}
                    >
                      {value ? familyLabel(value) : t("all")}
                      <span className="ml-1.5 text-text-tertiary">
                        {value ? counts[value] : allHits.length}
                      </span>
                    </Link>
                  );
                },
              )}
            </nav>
            <div className="mt-4">
              {tiers.map((tier) =>
                tier.items.length === 0 ? null : (
                  <div key={tier.key} data-search-tier={tier.key}>
                    {showTiers ? (
                      <p className="mt-6 px-3 font-mono text-[10px] uppercase tracking-label text-text-tertiary">
                        {t(tier.key)}
                      </p>
                    ) : null}
                    {groupByJstDate(tier.items.map((hit) => hit.article)).map(
                      (group) => (
                        <section key={group.date}>
                          <h2 className="border-b border-border-primary px-3 pb-1.5 pt-5 font-mono text-[11px] font-bold tracking-label text-text-secondary">
                            <time dateTime={group.date}>
                              {formatDateHeading(group.date, locale, latestYear)}
                            </time>
                          </h2>
                          {group.items.map((article) => (
                            <SearchResultRow
                              key={article.articleId}
                              article={article}
                              familyLabel={familyLabel(article.family)}
                              terms={terms}
                            />
                          ))}
                        </section>
                      ),
                    )}
                  </div>
                ),
              )}
            </div>
            <SeriesPagination
              series=""
              page={current.page}
              totalPages={current.totalPages}
              hrefFor={(number) => searchHref({ q, family, page: number })}
              copy={{
                label: tArticles("pagination.label"),
                newer: tArticles("pagination.newer"),
                older: tArticles("pagination.older"),
              }}
            />
          </>
        )}
      </main>
    </LatestArticlesRailLayout>
  );
}
