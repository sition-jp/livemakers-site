import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SectionDivider } from "@/components/ui/SectionDivider";

/**
 * G3 (2026-09-11 田平氏 GO): プライバシーポリシー。本サイトが実際に扱って
 * いる情報だけを書く (`grep -rn "analytics|gtag|plausible" app lib` はゼロ
 * ヒット・localStorage はテーマ切替のみ — `app/[locale]/layout.tsx` /
 * `components/ui/ThemeToggle.tsx`)。存在しない解析ツールを書かない。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: {
        ja: "/ja/privacy",
        en: "/en/privacy",
        "x-default": "/ja/privacy",
      },
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-10 text-4xl font-light tracking-title md:text-5xl">
        {t("title")}
      </h1>
      <p className="mb-12 text-lg leading-relaxed text-text-secondary">
        {t("intro")}
      </p>

      <SectionDivider />

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-light tracking-title">
          {t("accessLogsTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("accessLogsBody")}
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-light tracking-title">
          {t("analyticsTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("analyticsBody")}
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-light tracking-title">
          {t("localStorageTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("localStorageBody")}
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-light tracking-title">
          {t("cookieTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("cookieBody")}
        </p>
      </section>

      <SectionDivider />

      <section>
        <h2 className="mb-4 text-2xl font-light tracking-title">
          {t("contactTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("contactBody")}
        </p>
      </section>
    </article>
  );
}
