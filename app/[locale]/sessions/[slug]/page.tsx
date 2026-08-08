import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { Link } from "@/i18n/navigation";
import { SessionPendingView } from "@/components/sessions/SessionPendingView";
import {
  formatSessionTimestamp,
  findSessionRecord,
  getAllSessionRecords,
  getDaySessionNav,
} from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import { resolveSessionPageRecord } from "@/lib/sessions/session-page-resolver";
import { fetchLiveMarketData } from "@/lib/terminal/live-market-feed";

export function generateStaticParams() {
  return getAllSessionRecords().map((record) => ({
    slug: record.sessionId,
  }));
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sessions");

  const repoRecord = findSessionRecord(slug);
  const feed = await fetchLiveMarketData();
  const record = resolveSessionPageRecord({
    slug,
    repoRecords: repoRecord ? [repoRecord] : [],
    feedSessions: feed?.sessions ?? null,
  });
  if (!record) notFound();
  const definition = getSessionBySlug(record.sessionSlug);
  const nav = getDaySessionNav(record.sessionId);

  return (
    <article className="mx-auto w-full max-w-[72ch] px-4 py-10 sm:px-6">
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
  );
}
