import { setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { loadArticleInflowPreviewCatalog } from "@/lib/articles/article-inflow-feed";

export default async function ArticleInflowPreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const catalog = await loadArticleInflowPreviewCatalog();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">T7b hidden preview</p>
      <h1 className="mt-2 text-3xl font-bold text-text-primary">Article inflow overlay</h1>
      <p data-testid="article-inflow-feed-checksum" className="mt-3 font-mono text-xs text-text-tertiary">
        feed checksum: {catalog.feedChecksum ?? "repository-only"}
      </p>
      <ul className="mt-6 divide-y divide-border-primary border-y border-border-primary">
        {catalog.articles.map((article) => (
          <li key={article.articleId} className="py-4">
            <p className="font-mono text-[10px] uppercase text-text-tertiary">{article.family} · {article.source}</p>
            <Link href={article.href} className="mt-1 block font-semibold text-text-primary underline underline-offset-4">
              {article.titleJa}
            </Link>
            <Link href={`/article-inflow-preview/series/${article.family}`} className="mt-1 inline-block text-xs text-text-secondary">
              series preview
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
