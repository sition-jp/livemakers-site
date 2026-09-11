import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SectionDivider } from "@/components/ui/SectionDivider";

/**
 * G3 (2026-09-11 田平氏 GO): Google News / Publisher Center 前提条件の
 * 「編集方針ページ」。about page (`app/[locale]/about/page.tsx`) と同じ
 * 構造パターン (next-intl の `getTranslations` + `SectionDivider`) を踏襲。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "editorialPolicy" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: `/${locale}/editorial-policy`,
      languages: {
        ja: "/ja/editorial-policy",
        en: "/en/editorial-policy",
        "x-default": "/ja/editorial-policy",
      },
    },
  };
}

export default async function EditorialPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("editorialPolicy");

  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-10 text-4xl font-light tracking-title md:text-5xl">
        {t("title")}
      </h1>
      <p className="mb-12 text-lg leading-relaxed text-text-secondary">
        {t("intro")}
      </p>

      <SectionDivider />

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("operatorTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("operatorBody")}
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("aiVerificationTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("aiVerificationBody")}
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("sourcingTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("sourcingBody")}
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("correctionsTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("correctionsBody")}
        </p>
      </section>

      <SectionDivider />

      <section>
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("citationTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("citationBody")}
        </p>
      </section>
    </article>
  );
}
