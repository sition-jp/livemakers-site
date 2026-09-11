import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buildFlatNav } from "@/lib/home/nav-model";

export function Footer({ futureAtlasNav }: { futureAtlasNav: boolean }) {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  // 2026-08-14 田平氏指示: フッタもヘッダと同一のフラット順 (buildFlatNav)
  const items = buildFlatNav(futureAtlasNav);
  // Build metadata injected at build time via next.config.ts.
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
  const date = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

  return (
    <footer className="mt-24 border-t border-border-primary bg-bg-secondary">
      <div className="mx-auto max-w-[1920px] px-6 py-12 text-center text-xs text-text-tertiary">
        <div className="mb-2 tracking-logo text-text-primary">{t("brand")}</div>
        <div className="mb-1 tracking-label">{t("identity")}</div>
        <div className="mb-4 tracking-label">{t("dataSources")}</div>
        <nav
          className="mb-6 flex flex-wrap justify-center gap-x-5 gap-y-2 tracking-label"
          aria-label="footer"
        >
          {items.map((item) => (
            <Link key={item.key} href={item.href}>
              {nav(item.key)}
            </Link>
          ))}
        </nav>
        {/* G3 (2026-09-11 田平氏 GO): 編集方針・連絡先・プライバシーは
            記事▾ 導線とは別の Publisher Center 前提条件ページなので、
            共有ナビ (buildFlatNav — header と共用) には混ぜず、フッタ
            専用の 2 段目として独立させる。 */}
        <nav
          className="mb-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] tracking-label text-text-tertiary"
          aria-label="footer-legal"
        >
          <Link href="/editorial-policy">{t("editorialPolicy")}</Link>
          <Link href="/contact">{t("contact")}</Link>
          <Link href="/privacy">{t("privacy")}</Link>
        </nav>
        <div className="italic tracking-label">{t("disclaimer")}</div>
        <div className="mt-6 text-text-tertiary/70">{t("copyright")}</div>
        <div className="mt-2 font-mono text-[10px] tracking-label text-text-tertiary/50">
          LIVEMAKERS v{version} · BUILD {sha} · {date}
        </div>
      </div>
    </footer>
  );
}
