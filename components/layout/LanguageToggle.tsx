"use client";

import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";

const LOCALES = [
  { locale: "en", label: "EN" },
  { locale: "ja", label: "日本語" },
] as const;

/**
 * ヘッダ言語トグル (2026-08-21 田平氏 GO で復活)。
 *
 * localePrefix "always" + localeDetection false のため locale は URL
 * だけで決まる。cookie 書き換えや hard navigation の細工は不要で、
 * 同一ページの /ja・/en 版への明示リンク 2 本を置くだけでよい。
 * usePathname は locale 接頭辞を除いた path を返す。
 */
export function LanguageToggle() {
  const current = useLocale();
  const pathname = usePathname();
  const suffix = pathname === "/" ? "" : pathname;

  return (
    <div className="inline-flex items-center border border-border-primary p-0.5 text-[10px] tracking-label">
      {LOCALES.map(({ locale, label }) => (
        <a
          key={locale}
          href={`/${locale}${suffix}`}
          aria-current={current === locale ? "page" : undefined}
          className={
            "px-2 py-0.5 transition-colors " +
            (current === locale
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
