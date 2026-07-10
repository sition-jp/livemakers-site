import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { FAMILY_COLORS } from "@/components/home/ArticleRow";
import {
  getAllArticles,
  getArticleBody,
  getArticleBySlug,
} from "@/lib/articles/article-model";

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
      <div className="prose prose-neutral max-w-none dark:prose-invert">
        <MDXRemote source={body} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
      </div>
    </article>
  );
}
