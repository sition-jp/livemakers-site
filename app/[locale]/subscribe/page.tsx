import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ScopedIntlProvider } from "@/components/i18n/ScopedIntlProvider";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { localeAlternates } from "@/lib/seo/locale-alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subscribe" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates(locale, "/subscribe"),
  };
}

export default async function SubscribePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("subscribe");

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="mb-4 text-4xl font-light tracking-title">{t("title")}</h1>
      <p className="mb-12 text-text-secondary">{t("subtitle")}</p>
      <ScopedIntlProvider scope="subscribe">
        <SubscribeForm locale={locale === "ja" ? "ja" : "en"} />
      </ScopedIntlProvider>
    </section>
  );
}
