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
    <article className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-10 text-4xl font-light tracking-title md:text-5xl">
        {t("title")}
      </h1>

      {/* Section 1 — what we are */}
      <p className="mb-12 text-lg leading-relaxed text-text-secondary">
        {t("intro")}
      </p>

      <SectionDivider />

      {/* Section 2 — two audiences */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("audiencesTitle")}
        </h2>
        <p className="mb-5 leading-relaxed text-text-secondary">
          {t("audiencesInstitutional")}
        </p>
        <p className="leading-relaxed text-text-secondary">
          {t("audiencesLifestyle")}
        </p>
      </section>

      {/* Section 3 — why Cardano + Midnight */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("whyTitle")}
        </h2>
        <p className="mb-5 leading-relaxed text-text-secondary">
          {t("whyBody1")}
        </p>
        <p className="leading-relaxed text-text-secondary">{t("whyBody2")}</p>
      </section>

      {/* Section 4 — methodology (SDE) */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("processTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">{t("processBody")}</p>
      </section>

      <SectionDivider />

      {/* Section 5 — SITION Group identity */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("sipoTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">{t("sipoBody")}</p>
      </section>

      <SectionDivider />

      {/* Disclaimer */}
      <section>
        <h2 className="mb-4 text-2xl font-light tracking-title">
          {t("disclaimerTitle")}
        </h2>
        <p className="italic text-text-secondary">{t("disclaimerBody")}</p>
      </section>
    </article>
  );
}
