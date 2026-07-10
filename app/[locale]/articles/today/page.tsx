import { getTranslations, setRequestLocale } from "next-intl/server";

import { ArticleRow } from "@/components/home/ArticleRow";
import { getAllArticles } from "@/lib/articles/article-model";
import { loadMarketSnapshot } from "@/lib/home/market-snapshot";

const LATEST_FALLBACK_COUNT = 5;

export default async function TodayArticlesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("articles");
  const articles = getAllArticles();
  const today = loadMarketSnapshot().dataDate;
  const todaysArticles = articles.filter((article) =>
    article.publishedAtJst.startsWith(today),
  );
  const visibleArticles =
    todaysArticles.length > 0
      ? todaysArticles
      : articles.slice(0, LATEST_FALLBACK_COUNT);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-text-primary">{t("todayTitle")}</h1>
      {todaysArticles.length === 0 && (
        <div className="mt-6">
          <p className="text-sm text-text-secondary">{t("todayEmpty")}</p>
          <h2 className="mt-8 text-lg font-bold text-text-primary">
            {t("latestTitle")}
          </h2>
        </div>
      )}
      <div className="mt-6 border-t border-border-primary">
        {visibleArticles.map((article) => (
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
