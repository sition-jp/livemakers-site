import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getAllSessionRecords } from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";

export default async function SessionArchivePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sessions");
  const records = getAllSessionRecords().filter(
    (record) => record.articleStatus === "published",
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-text-primary">
        {t("archiveTitle")}
      </h1>
      <p className="mt-3 text-sm text-text-secondary">{t("archiveNote")}</p>
      <div className="mt-8 border-t border-border-primary">
        {records.map((record) => {
          const definition = getSessionBySlug(record.sessionSlug);
          return (
            <Link
              key={record.sessionId}
              href={record.currentUrl}
              data-article-id={record.sessionId}
              className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border-primary px-3 py-3 transition-colors hover:bg-bg-tertiary"
            >
              <span className="rounded-sm border border-accent px-1.5 py-0.5 text-[9px] font-bold tracking-label text-accent">
                {t("family")}
              </span>
              <span className="min-w-0 text-sm font-semibold text-text-primary group-hover:underline">
                {definition.nameEn} {record.date}
              </span>
              <time className="whitespace-nowrap font-mono text-[10px] text-text-tertiary">
                {record.publishedAt}
              </time>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
