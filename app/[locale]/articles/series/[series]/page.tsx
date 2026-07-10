import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArticleRow } from "@/components/home/ArticleRow";
import { Link } from "@/i18n/navigation";
import {
  SERIES_SLUGS,
  getAllArticles,
  type SeriesSlug,
} from "@/lib/articles/article-model";

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
  const articles = getAllArticles().filter(
    (article) => article.family === series,
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">
        {t("seriesTitle")}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-text-primary">
        {t(`family.${series}`)}
      </h1>
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
  );
}
