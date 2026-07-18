import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { FAMILY_COLORS } from "@/components/home/ArticleRow";
import { ArticleContractBlock } from "@/components/future-atlas/ArticleContractBlock";
import { AuthorshipLine } from "@/components/future-atlas/AuthorshipLine";
import {
  getAllArticles,
  getArticleBody,
  getArticleBySlug,
} from "@/lib/articles/article-model";
import { loadFutureAtlas } from "@/lib/future-atlas/load";

export function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.articleId }));
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("articles");

  let article;
  try {
    article = getArticleBySlug(slug);
  } catch {
    notFound();
  }

  const language = locale === "en" ? "en" : "ja";
  const body = getArticleBody(slug, language);
  const title = language === "en" ? (article.titleEn ?? article.titleJa) : article.titleJa;
  const futureAtlas = await loadFutureAtlas();
  const manifestEntry = futureAtlas.manifest.entries.find((entry) => entry.articleId === article.articleId);
  const contracts = manifestEntry?.kind === "forecast"
    ? futureAtlas.contracts.filter((contract) => contract.articleId === article.articleId)
    : [];

  return (
    <article className="mx-auto w-full max-w-[72ch] px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-border-primary pb-6">
        <p
          className="mb-3 font-mono text-[10px] font-bold uppercase tracking-label"
          style={{ color: FAMILY_COLORS[article.family] }}
        >
          {t(`family.${article.family}`)}
        </p>
        <h1 className="text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
          {title}
        </h1>
        <time className="mt-4 block font-mono text-xs text-text-tertiary">
          {article.publishedLabel}
        </time>
      </header>
      {manifestEntry && <AuthorshipLine authorshipMode={manifestEntry.authorshipMode} />}
      {contracts.map((contract) => {
        const state = futureAtlas.states.get(contract.forecastId);
        if (!state) {
          throw new Error(`missing replay state for ${contract.forecastId}`);
        }
        return (
          <ArticleContractBlock
            key={contract.forecastId}
            contract={contract}
            state={state}
          />
        );
      })}
      <div className="prose prose-neutral max-w-none dark:prose-invert">
        <MDXRemote source={body} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
      </div>
    </article>
  );
}
