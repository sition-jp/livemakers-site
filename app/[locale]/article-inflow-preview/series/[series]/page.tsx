import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SERIES_SLUGS, type SeriesSlug } from "@/lib/articles/article-model";
import { loadArticleInflowPreviewCatalog } from "@/lib/articles/article-inflow-feed";

function isSeriesSlug(value: string): value is SeriesSlug {
  return SERIES_SLUGS.includes(value as SeriesSlug);
}

export default async function ArticleInflowPreviewSeriesPage({ params }: { params: Promise<{ locale: string; series: string }> }) {
  const { locale, series } = await params;
  setRequestLocale(locale);
  if (!isSeriesSlug(series)) notFound();
  const catalog = await loadArticleInflowPreviewCatalog();
  const articles = catalog.articles.filter((article) => article.family === series);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">T7b hidden series preview</p>
      <h1 className="mt-2 text-3xl font-bold text-text-primary">{series}</h1>
      <ul className="mt-6 divide-y divide-border-primary border-y border-border-primary">
        {articles.map((article) => (
          <li key={article.articleId} className="py-4">
            <Link href={article.href} className="font-semibold text-text-primary underline underline-offset-4">{article.titleJa}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
