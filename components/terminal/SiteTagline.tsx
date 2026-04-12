import { useTranslations } from "next-intl";

/**
 * Brand positioning tagline that sits between the live ticker and the
 * editorial hero on the OVERVIEW page.
 *
 * Two lines:
 *   • Tagline (italic, primary text color) — the brand promise
 *   • Subtitle (smaller, tertiary text color) — the explanatory subtitle
 *
 * Subtle bordering matches the ticker bar above so the page has a
 * continuous "masthead" feel before the editorial hero takes over.
 */
export function SiteTagline() {
  const t = useTranslations("overview");
  return (
    <section className="border-b border-border-primary bg-bg-primary px-6 py-6 text-center">
      <p className="mx-auto max-w-3xl text-base italic leading-relaxed text-text-primary md:text-lg">
        {t("tagline")}
      </p>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-relaxed text-text-tertiary md:text-sm">
        {t("subtitle")}
      </p>
    </section>
  );
}
