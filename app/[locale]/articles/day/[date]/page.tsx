import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArticleRow } from "@/components/home/ArticleRow";
import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import {
  adjacentDays,
  formatDayLabel,
  parseDayParam,
  selectArticlesForDay,
} from "@/lib/articles/day-archive";
import { resolveTodayJst } from "@/lib/home/resolve-today";
import { localeAlternates } from "@/lib/seo/locale-alternates";
import { Link } from "@/i18n/navigation";

// 5 min, same as /articles/today: a not-yet-populated day's 404 must not stick
// for an hour. Repeat loads stay fast via stale-while-revalidate, and the 12:30
// digest job warms the previous day's page.
export const revalidate = 300;

// Empty array (not omitted): a dynamic route without generateStaticParams is
// rendered on every request and `revalidate` has no effect. With [] each date
// is built on first visit, then cached (ISR).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}): Promise<Metadata> {
  const { locale, date } = await params;
  const t = await getTranslations({ locale, namespace: "articles" });
  const parsed = parseDayParam(date, "9999-12-31");
  let title = t("todayTitle");
  if (parsed) {
    const { articles } = await loadPublicArticleInflowCatalog();
    const label = formatDayLabel(parsed);
    title = t("dayTitle", {
      month: label.month,
      day: label.day,
      count: selectArticlesForDay(articles, parsed).length,
    });
  }
  return {
    title,
    alternates: localeAlternates(locale, `/articles/day/${date}`),
  };
}

export default async function DayArticlesPage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;
  setRequestLocale(locale);
  const todayJst = resolveTodayJst(new Date());
  const day = parseDayParam(date, todayJst);
  if (!day) notFound();

  const t = await getTranslations("articles");
  const { articles } = await loadPublicArticleInflowCatalog();
  const dayArticles = selectArticlesForDay(articles, day);
  if (dayArticles.length === 0) notFound();

  const label = formatDayLabel(day);
  const { prev, next } = adjacentDays(day, todayJst);

  return (
    <main
      className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6"
      data-day={day}
      data-article-count={dayArticles.length}
    >
      <h1 className="text-3xl font-bold text-text-primary">
        {t("dayTitle", {
          month: label.month,
          day: label.day,
          count: dayArticles.length,
        })}
      </h1>
      <nav className="mt-4 flex justify-between text-sm text-text-secondary">
        <Link href={`/articles/day/${prev}`}>{t("dayPrev")}</Link>
        {next && <Link href={`/articles/day/${next}`}>{t("dayNext")}</Link>}
      </nav>
      <div className="mt-6 border-t border-border-primary">
        {dayArticles.map((article) => (
          <ArticleRow
            key={article.articleId}
            article={article}
            familyLabel={t(`family.${article.family}`)}
          />
        ))}
      </div>
    </main>
  );
}
