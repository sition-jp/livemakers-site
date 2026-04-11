import { setRequestLocale, getTranslations } from "next-intl/server";
import { SectionDivider } from "@/components/ui/SectionDivider";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <article className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="mb-12 text-4xl font-light tracking-title">{t("title")}</h1>
      <p className="mb-12 text-lg leading-relaxed text-text-secondary">{t("intro")}</p>

      <SectionDivider />

      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-light tracking-title">{t("sipoTitle")}</h2>
        <p className="text-text-secondary">{t("sipoBody")}</p>
      </section>

      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-light tracking-title">{t("processTitle")}</h2>
        <p className="text-text-secondary">{t("processBody")}</p>
      </section>

      <SectionDivider />

      <section>
        <h2 className="mb-4 text-2xl font-light tracking-title">{t("disclaimerTitle")}</h2>
        <p className="italic text-text-secondary">{t("disclaimerBody")}</p>
      </section>
    </article>
  );
}
