import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { FAMILY_COLORS } from "@/components/home/ArticleRow";
import { ArticleContractBlock } from "@/components/future-atlas/ArticleContractBlock";
import { AuthorshipLine } from "@/components/future-atlas/AuthorshipLine";
import { createArticleMdxComponents } from "@/components/articles/ArticleBodyComponents";
import { ArticlePrevNext } from "@/components/articles/ArticlePrevNext";
import { ArticleThumbnail } from "@/components/articles/ArticleThumbnail";
import { RelatedArticles } from "@/components/articles/RelatedArticles";
import { SeriesRail, type SeriesRailCopy } from "@/components/articles/SeriesRail";
import {
  ARTICLE_FAMILIES,
  getAllArticles,
  type ArticleFamily,
} from "@/lib/articles/article-model";
import {
  loadPublicArticleInflowCatalog,
  loadPublicArticleInflowDetail,
} from "@/lib/articles/article-inflow-feed";
import { getRelatedArticles, getSeriesNeighbors } from "@/lib/articles/related";
import { applyArticleDisplayTransform } from "@/lib/articles/display-transform";
import { extractToc } from "@/lib/articles/toc";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadEffectiveSurfacePublished } from "@/lib/future-atlas/surface";

export const dynamicParams = true;
export const revalidate = 300;

const TOC_MIN_HEADINGS = 3;

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

  const language = locale === "en" ? "en" : "ja";
  const detail = await loadPublicArticleInflowDetail(slug, language);
  if (!detail) notFound();
  const { article, body } = detail;
  const title = language === "en" ? (article.titleEn ?? article.titleJa) : article.titleJa;
  const futureAtlas = await loadFutureAtlas();
  const surfacePublished = await loadEffectiveSurfacePublished(futureAtlas);
  const manifestEntry = futureAtlas.manifest.entries.find((entry) => entry.articleId === article.articleId);
  const contracts = manifestEntry?.kind === "forecast"
    ? futureAtlas.contracts.filter((contract) => contract.articleId === article.articleId)
    : [];

  const catalog = await loadPublicArticleInflowCatalog();
  const neighbors = getSeriesNeighbors(catalog.articles, article);
  const related = getRelatedArticles(catalog.articles, article);
  // INFLOW-G2 D2: 表示層タイトル抑止。受領 body (= source) は不変のまま、
  // MDX へ渡すテキストだけを変換する。T1a 時点では transform は inert
  // (ACTIVE_ARTICLE_DISPLAY_TRANSFORM_ID = "none"・display == source)
  const display = applyArticleDisplayTransform(body, title);
  const toc = extractToc(display.displayBody);
  const showToc = toc.length >= TOC_MIN_HEADINGS;

  const familyLabel = t(`family.${article.family}`);
  const familyLabels = Object.fromEntries(
    ARTICLE_FAMILIES.map((family) => [family, t(`family.${family}`)]),
  ) as Record<ArticleFamily, string>;
  const railCopy: SeriesRailCopy = {
    railTitle: t("detail.railTitle"),
    currentSeriesTitle: t("detail.currentSeriesTitle"),
    viewAll: t("detail.viewAll"),
    sessionTerminalHeading: t("detail.sessionTerminalHeading"),
    sessionTerminalEntry: t("detail.sessionTerminalEntry"),
    atlasPublishedHeading: t("detail.atlasPublishedHeading"),
    atlasUnpublishedHeading: t("detail.atlasUnpublishedHeading"),
    familyLabels,
  };

  return (
    <div
      data-article-layout=""
      className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8"
    >
      <article className="mx-auto w-full max-w-[80ch] min-w-0">
        <header className="mb-8 border-b border-border-primary pb-6">
          <p
            className="mb-3 font-mono text-[10px] font-bold uppercase tracking-label"
            style={{ color: FAMILY_COLORS[article.family] }}
          >
            {familyLabel}
          </p>
          <h1 className="text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
            {title}
          </h1>
          <time className="mt-4 block font-mono text-xs text-text-tertiary">
            {article.publishedLabel}
          </time>
          {article.excerptJa ? (
            // site-first 記事の packet meta 由来の要約 (TQ3)。mirror 記事は
            // excerpt を持たない = 冒頭リード段落がその役割を担う (非表示)
            <p
              data-article-excerpt=""
              className="mt-4 border-l-2 border-border-primary pl-4 text-[15px] leading-relaxed text-text-secondary"
            >
              {article.excerptJa}
            </p>
          ) : null}
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
        {/* INFLOW-G2 T1a (D4): 検証済みサムネ or placeholder 帯。固定 16:9 枠で
            画像有無により本文位置が動かない (CLS ゼロ)。atlas chrome の
            「authorship は header 直後」契約を守るため authorship/contract の後段 */}
        <ArticleThumbnail
          thumbnailUrl={article.thumbnailUrl}
          family={article.family}
          title={title}
          variant="fixed"
          className="mb-8 rounded-lg border border-border-primary"
        />
        {showToc ? (
          <nav
            data-article-toc=""
            aria-label={t("detail.tocTitle")}
            className="mb-8 rounded-lg border border-border-primary bg-bg-secondary p-4"
          >
            <p className="text-[11px] font-bold tracking-label text-text-tertiary">
              {t("detail.tocTitle")}
            </p>
            <ol className="mt-2 space-y-1.5">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-sm text-text-secondary hover:text-text-primary hover:underline"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div
          data-testid="article-inflow-public-body"
          lang="ja"
          data-article-source={article.source}
          data-article-slug={article.articleId}
          data-declared-body-checksum={detail.declaredBodyChecksum}
          data-source-body-checksum={detail.renderedBodyChecksum}
          data-display-body-checksum={display.displayBodyChecksum}
          data-display-transform-id={display.displayTransformId}
          /* data-rendered-body-checksum = deprecated compatibility alias
             (値 = 受領 body の checksum)。新 observer は source/display の
             3 点 (T2a) を検証根拠にし、この alias を根拠にしない */
          data-rendered-body-checksum={detail.renderedBodyChecksum}
          className="prose prose-neutral max-w-none dark:prose-invert"
        >
          <MDXRemote
            source={display.displayBody}
            components={createArticleMdxComponents(display.displayBody)}
            options={{
              blockJS: true,
              blockDangerousJS: true,
              mdxOptions: { format: "md", remarkPlugins: [remarkGfm] },
            }}
          />
        </div>
        <ArticlePrevNext
          prev={neighbors.prev}
          next={neighbors.next}
          prevLabel={t("detail.prevLabel", { series: familyLabel })}
          nextLabel={t("detail.nextLabel", { series: familyLabel })}
        />
        <RelatedArticles
          articles={related}
          title={t("detail.relatedTitle")}
          familyLabels={familyLabels}
        />
      </article>
      <SeriesRail
        articles={catalog.articles}
        current={article}
        surfacePublished={surfacePublished}
        copy={railCopy}
      />
    </div>
  );
}
