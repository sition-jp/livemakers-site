import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buildNavModel } from "@/lib/home/nav-model";

export function Footer({ futureAtlasNav }: { futureAtlasNav: boolean }) {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");
  const navModel = buildNavModel(futureAtlasNav);
  // Footer mirrors the same nav-model as the header (G44 D3), rendered flat.
  const items = [...navModel.articlesGroup, ...navModel.topLevel];
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
          <Link href="/">{nav("overview")}</Link>
          {items.map((item) => (
            <Link key={item.key} href={item.href}>
              {nav(item.key)}
            </Link>
          ))}
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
