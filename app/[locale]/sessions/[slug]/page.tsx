import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import {
  getAllSessionRecords,
  getSessionRecord,
} from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";

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

  let record;
  try {
    record = getSessionRecord(slug);
  } catch {
    notFound();
  }
  const definition = getSessionBySlug(record.sessionSlug);

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
            ? `${t("publishedAt")} ${record.publishedAt}`
            : `${t("liveAsOf")} ${record.asOfJst}`}
        </p>
      </header>

      {record.articleStatus === "published" && record.bodyJa ? (
        <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
          <MDXRemote
            source={record.bodyJa}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3 text-[15px] text-text-primary">
            {record.bullets.map((bullet) => (
              <li
                key={bullet}
                className="border-b border-dashed border-border-primary pb-3"
              >
                {bullet}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-text-tertiary">
            {t("crystallizeNote")}
          </p>
        </>
      )}
    </article>
  );
}
