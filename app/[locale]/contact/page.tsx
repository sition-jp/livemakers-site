import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";

const X_PROFILE_URL = "https://x.com/LiveMakersCom";
const SITION_URL = "https://sition.jp";

/**
 * G3 (2026-09-11 田平氏 GO): 連絡先ページ。連絡手段は X の DM と SITION 公式
 * サイトへのリンクのみ — メールアドレスは作らない (指示どおり)。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: {
      canonical: `/${locale}/contact`,
      languages: {
        ja: "/ja/contact",
        en: "/en/contact",
        "x-default": "/ja/contact",
      },
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-10 text-4xl font-light tracking-title md:text-5xl">
        {t("title")}
      </h1>
      <p className="mb-12 text-lg leading-relaxed text-text-secondary">
        {t("intro")}
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-light tracking-title">
          {t("xLabel")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("xBody")}{" "}
          <a
            href={X_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-text-primary"
          >
            @LiveMakersCom
          </a>
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-light tracking-title">
          {t("siteLabel")}
        </h2>
        <p className="leading-relaxed text-text-secondary">
          {t("siteBody")}{" "}
          <a
            href={SITION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-text-primary"
          >
            sition.jp
          </a>
        </p>
      </section>
    </article>
  );
}
