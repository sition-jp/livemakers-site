import { setRequestLocale, getTranslations } from "next-intl/server";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";

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
      <SubscribeForm locale={locale === "ja" ? "ja" : "en"} />
    </section>
  );
}
