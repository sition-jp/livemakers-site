/**
 * Language switch for brief detail pages.
 *
 * 2026-08-21: localePrefix "always" + localeDetection false になり、
 * locale は URL だけで決まる。以前ここにあった NEXT_LOCALE cookie の
 * 書き換え + window.location.assign の細工 (cookie が無接頭 URL を
 * 上書きしていた as-needed 時代の回避策) は不要になったため、
 * 明示 URL のリンク 2 本へ簡素化した。client component も不要。
 */
export function BriefLanguageSwitch({
  slug,
  currentLang,
}: {
  slug: string;
  currentLang: "en" | "ja";
}) {
  const locales = [
    { lang: "en", label: "EN", href: `/en/brief/${slug}` },
    { lang: "ja", label: "日本語", href: `/ja/brief/${slug}` },
  ] as const;

  return (
    <div className="inline-flex items-center gap-1 border border-border-primary p-1 text-[10px] tracking-label">
      {locales.map(({ lang, label, href }) => (
        <a
          key={lang}
          href={href}
          aria-current={currentLang === lang ? "page" : undefined}
          className={
            "px-3 py-1 transition-colors " +
            (currentLang === lang
              ? "bg-pillar-overview text-bg-primary"
              : "text-text-secondary hover:text-text-primary")
          }
        >
          {label}
        </a>
      ))}
    </div>
  );
}
