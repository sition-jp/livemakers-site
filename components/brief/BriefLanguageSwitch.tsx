"use client";

/**
 * Language switch for brief detail pages.
 *
 * Why this is a client component (was a server component until 2026-04-12):
 * next-intl's middleware honors the NEXT_LOCALE cookie when serving
 * non-prefixed routes. A plain `<Link href="/brief/foo">` from /ja
 * (where the cookie is "ja") gets a 307 redirect back to /ja/brief/foo
 * because the cookie outranks the URL. We must update the cookie to "en"
 * BEFORE navigating, otherwise the EN link silently bounces to JA.
 *
 * We also use a hard navigation (window.location.assign) for the same
 * reason as Header.tsx — Next.js's soft router resolves "/" to the
 * current locale and skips the middleware re-evaluation.
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

  function go(target: "en" | "ja") {
    if (target === currentLang) return;
    document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.assign(target === "en" ? enHref : jaHref);
  }

  return (
    <div className="inline-flex items-center gap-1 border border-border-primary p-1 text-[10px] tracking-label">
      <button
        type="button"
        onClick={() => go("en")}
        className={
          "px-3 py-1 transition-colors " +
          (currentLang === "en"
            ? "bg-pillar-overview text-bg-primary"
            : "text-text-secondary hover:text-text-primary")
        }
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => go("ja")}
        className={
          "px-3 py-1 transition-colors " +
          (currentLang === "ja"
            ? "bg-pillar-overview text-bg-primary"
            : "text-text-secondary hover:text-text-primary")
        }
      >
        日本語
      </button>
    </div>
  );
}
