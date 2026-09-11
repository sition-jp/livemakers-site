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

      {/* Section 3 — what we observe (金融再起動の 5 テーマ) */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("themesTitle")}
        </h2>
        <p className="mb-6 leading-relaxed text-text-secondary">
          {t("themesLead")}
        </p>
        <ul className="space-y-4">
          {(
            [
              "themeCrypto",
              "themeAI",
              "themeQuantum",
              "themeBio",
              "themeMacro",
            ] as const
          ).map((key) => (
            <li key={key} className="leading-relaxed text-text-secondary">
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      {/* Section 4 — methodology (SDE) */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("processTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">{t("processBody")}</p>
      </section>

      {/* Section 4b — editorial desk (記事署名 #editorial-desk の飛び先) */}
      <section className="mb-16 scroll-mt-24" id="editorial-desk">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("deskTitle")}
        </h2>
        <p className="leading-relaxed text-text-secondary">{t("deskBody")}</p>
      </section>

      <SectionDivider />

      {/* Section 5 — SITION Group identity */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-light tracking-title">
          {t("sipoTitle")}
        </h2>
        <p className="mb-5 leading-relaxed text-text-secondary">
          {t("sipoStats")}
        </p>
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
