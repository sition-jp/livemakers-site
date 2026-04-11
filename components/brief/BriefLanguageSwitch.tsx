import Link from "next/link";

/**
 * URL-based language switch for brief articles. Server component — no client
 * state, no hooks. Switching languages navigates to the matching locale's
 * version of the same brief.
 */
export function BriefLanguageSwitch({
  slug,
  currentLang,
}: {
  slug: string;
  currentLang: "en" | "ja";
}) {
  const enHref = `/brief/${slug}`;
  const jaHref = `/ja/brief/${slug}`;

  return (
    <div className="inline-flex items-center gap-1 border border-border-primary p-1 text-[10px] tracking-label">
      <Link
        href={enHref}
        className={
          "px-3 py-1 " +
          (currentLang === "en"
            ? "bg-pillar-overview text-bg-primary"
            : "text-text-secondary hover:text-text-primary")
        }
      >
        EN
      </Link>
      <Link
        href={jaHref}
        className={
          "px-3 py-1 " +
          (currentLang === "ja"
            ? "bg-pillar-overview text-bg-primary"
            : "text-text-secondary hover:text-text-primary")
        }
      >
        日本語
      </Link>
    </div>
  );
}
