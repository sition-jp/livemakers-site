import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { Link } from "@/i18n/navigation";
import { SeriesRail } from "@/components/articles/SeriesRail";
import { SessionPendingView } from "@/components/sessions/SessionPendingView";
import { loadRailContext } from "@/lib/articles/article-detail-context";
import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { isArticleInflowV2Enabled } from "@/lib/articles/article-inflow-v2";
import { loadSeriesRailCopy } from "@/lib/articles/series-rail-copy";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadEffectiveSurfacePublished } from "@/lib/future-atlas/surface";
import { getLatestPostedVideo, getPostedVideoCards } from "@/lib/videos";
import {
  formatSessionTimestamp,
  findSessionRecord,
  getAllSessionRecords,
  getDaySessionNav,
} from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import { resolveSessionPageRecord } from "@/lib/sessions/session-page-resolver";
import { fetchLiveMarketData } from "@/lib/terminal/live-market-feed";
import { localeAlternates } from "@/lib/seo/locale-alternates";

export function generateStaticParams() {
  return getAllSessionRecords().map((record) => ({
    slug: record.sessionId,
  }));
}

async function loadSessionPageRecord(slug: string) {
  const repoRecord = findSessionRecord(slug);
  const feed = await fetchLiveMarketData();
  return resolveSessionPageRecord({
    slug,
    repoRecords: repoRecord ? [repoRecord] : [],
    feedSessions: feed?.sessions ?? null,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const record = await loadSessionPageRecord(slug);
  if (!record) return {};
  const definition = getSessionBySlug(record.sessionSlug);
  return {
    title: `${definition.nameEn} ${record.date}`,
    description: record.titleJa,
    alternates: localeAlternates(locale, `/sessions/${record.sessionId}`),
  };
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sessions");

  const record = await loadSessionPageRecord(slug);
  if (!record) notFound();
  const definition = getSessionBySlug(record.sessionSlug);
  const nav = getDaySessionNav(record.sessionId);

  // 右レール (2026-11-05 田平氏 GO): 記事詳細・動画の記事と同じ SeriesRail を同じ取り方で
  // (v2 = rail + リポジトリ / v1 = カタログ)。セッション記事は catalog に無いので current = null
  const futureAtlas = await loadFutureAtlas();
  const { railArticles, surfacePublished } = isArticleInflowV2Enabled()
    ? await loadRailContext(futureAtlas.config)
    : {
        railArticles: (await loadPublicArticleInflowCatalog()).articles,
        surfacePublished: await loadEffectiveSurfacePublished(futureAtlas),
      };
  const tVideos = await getTranslations("videos");
  const latestVideo = getLatestPostedVideo();

  return (
    <div
      data-session-layout=""
      className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8"
    >
      <article className="mx-auto w-full max-w-[72ch] min-w-0">
        <header className="border-b border-border-primary pb-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-label text-accent">
            {t("family")}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-text-primary">
            {definition.nameEn} {record.date}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">{record.titleJa}</p>
          <p className="mt-4 font-mono text-xs text-text-tertiary">
            {record.articleStatus === "published"
              ? `${t("publishedAt")} ${formatSessionTimestamp(record.publishedAt)}`
              : `${t("liveAsOf")} ${formatSessionTimestamp(record.asOfJst)}`}
          </p>
        </header>

        {locale === "ja" &&
        record.articleStatus === "published" &&
        record.bodyJa ? (
          <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
            <MDXRemote
              source={record.bodyJa}
              options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            />
          </div>
        ) : (
          <SessionPendingView
            record={record}
            locale={locale}
            copy={{
              snapshotHeading: t("snapshotHeading"),
              highlightsHeading: t("highlightsHeading"),
              watchHeading: t("watchHeading"),
              crystallizeNote: t("crystallizeNote"),
              noSnapshotNote: t("noSnapshotNote"),
              noNumbersNote: t("noNumbersNote"),
            }}
          />
        )}

        <nav className="mt-10 flex justify-between border-t border-border-primary pt-4 text-sm">
          {nav.prev ? (
            <Link
              href={nav.prev.currentUrl}
              className="font-bold text-accent"
            >
              ← {t("prev")}
            </Link>
          ) : (
            <span />
          )}
          {nav.next ? (
            <Link
              href={nav.next.currentUrl}
              className="ml-auto font-bold text-accent"
            >
              {t("next")} →
            </Link>
          ) : null}
        </nav>
      </article>
      <SeriesRail
        articles={railArticles}
        current={null}
        surfacePublished={surfacePublished}
        copy={await loadSeriesRailCopy()}
        latestVideo={
          latestVideo
            ? {
                video: latestVideo,
                heading: tVideos("railLatestHeading"),
                watchLabel: tVideos("railWatch"),
              }
            : null
        }
        latestVideoRows={{ items: getPostedVideoCards(), label: tVideos("rowLabel") }}
      />
    </div>
  );
}
