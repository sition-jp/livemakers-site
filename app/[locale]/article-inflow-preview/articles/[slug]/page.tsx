import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { loadArticleInflowPreviewDetail } from "@/lib/articles/article-inflow-feed";

export default async function ArticleInflowPreviewDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const language = locale === "en" ? "en" : "ja";
  const detail = await loadArticleInflowPreviewDetail(slug, language);
  if (!detail) notFound();

  return (
    <article className="mx-auto w-full max-w-[72ch] px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-border-primary pb-6">
        <p className="font-mono text-[10px] uppercase text-text-tertiary">T7b hidden preview · {detail.article.source}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-text-primary">{detail.article.titleJa}</h1>
        <time className="mt-4 block font-mono text-xs text-text-tertiary">{detail.article.publishedLabel}</time>
      </header>
      <div
        data-testid="article-inflow-preview-body"
        data-declared-body-checksum={detail.declaredBodyChecksum}
        data-rendered-body-checksum={detail.renderedBodyChecksum}
        className="prose prose-neutral max-w-none dark:prose-invert"
      >
        <MDXRemote source={detail.body} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
      </div>
    </article>
  );
}
