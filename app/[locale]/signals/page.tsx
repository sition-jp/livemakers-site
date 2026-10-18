import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SignalsFeed } from "@/components/terminal/SignalsFeed";
import { localeAlternates } from "@/lib/seo/locale-alternates";

/**
 * /signals — three-bucket Signal feed page.
 *
 * Server component wrapper sets locale + request-level context; the
 * interactive SignalsFeed child is a client component (SWR polling every
 * 60s). We keep the wrapper thin so that next-intl server-side features
 * (setRequestLocale) can cooperate with the client child naturally.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "signals" });
  return {
    title: t("page_title"),
    description: t("page_subtitle"),
    alternates: localeAlternates(locale, "/signals"),
  };
}

export default async function SignalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("signals");
  const normalizedLocale = locale === "ja" ? "ja" : "en";

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <header className="mb-8">
        <h1 className="mb-2 text-4xl font-light tracking-title">
          {t("page_title")}
        </h1>
        <p className="text-text-secondary">{t("page_subtitle")}</p>
      </header>
      <SignalsFeed locale={normalizedLocale} />
    </section>
  );
}
