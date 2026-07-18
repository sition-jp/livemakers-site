import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { FutureAtlasData } from "@/lib/future-atlas/load";

export function ThemeShelves({ data, locale }: { data: FutureAtlasData; locale: "ja" | "en" }) {
  const t = useTranslations("futureAtlas");

  return (
    <section aria-label={t("surface.themesAriaLabel")} className="grid gap-6 lg:grid-cols-2">
      {[...data.manifest.themes].sort((left, right) => left.order - right.order).map((theme) => {
        const entries = data.manifest.entries
          .filter((entry) => entry.themes.includes(theme.key))
          .sort((left, right) => left.atlasPlacement - right.atlasPlacement);

        return (
          <section key={theme.key} className="border border-border-primary p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-text-primary">{locale === "en" ? (theme.titleEn ?? theme.titleJa) : theme.titleJa}</h2>
            <div className="mt-4 space-y-3">
              {entries.map((entry) => {
                const article = data.articles.get(entry.articleId);
                if (!article) return null;

                return (
                  <article key={entry.articleId} className="border-l-2 border-border-primary pl-3">
                    <span
                      data-atlas-format={entry.kind}
                      className="inline-flex rounded-sm border border-border-primary px-1.5 py-0.5 text-[10px] font-bold tracking-label text-text-secondary"
                    >
                      {t(`kind.${entry.kind}`)}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-text-primary">
                      <Link href={article.href} className="hover:underline">{locale === "en" ? (article.titleEn ?? article.titleJa) : article.titleJa}</Link>
                    </h3>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
