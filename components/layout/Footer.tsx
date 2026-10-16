import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { XIcon } from "@/components/brand/XIcon";
import { buildFlatNav } from "@/lib/home/nav-model";
import { SITION_URL, X_HANDLE, X_PROFILE_URL } from "@/lib/site";

export function Footer({ futureAtlasNav }: { futureAtlasNav: boolean }) {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const follow = useTranslations("follow");
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
          {/* 2026-10-16 田平氏決定: 事業者名は SITION。運営元 sition.jp への
              戻り導線 (sipo.tokyo / lifemakers.com と同じく 1 本)。 */}
          <a href={SITION_URL} target="_blank" rel="noopener noreferrer">
            {t("operator")}
          </a>
        </nav>
        {/* 公式 X (2026-10-12 田平氏 GO) */}
        <div className="mb-6 flex justify-center">
          <a
            href={X_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 tracking-label text-text-secondary hover:text-text-primary"
          >
            <XIcon className="h-3.5 w-3.5" />
            {follow("xProfile", { handle: X_HANDLE })}
          </a>
        </div>
        <div className="italic tracking-label">{t("disclaimer")}</div>
        <div className="mt-6 text-text-tertiary/70">{t("copyright")}</div>
        <div className="mt-2 font-mono text-[10px] tracking-label text-text-tertiary/50">
          LIVEMAKERS v{version} · BUILD {sha} · {date}
        </div>
      </div>
    </footer>
  );
}
