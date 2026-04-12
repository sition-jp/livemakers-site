import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  // Build metadata injected at build time via next.config.ts.
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
  const date = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

  return (
    <footer className="mt-24 border-t border-border-primary bg-bg-secondary">
      <div className="mx-auto max-w-7xl px-6 py-12 text-center text-xs text-text-tertiary">
        <div className="mb-2 tracking-logo text-text-primary">{t("brand")}</div>
        <div className="mb-1 tracking-label">{t("identity")}</div>
        <div className="mb-4 tracking-label">{t("dataSources")}</div>
        <div className="italic tracking-label">{t("disclaimer")}</div>
        <div className="mt-6 text-text-tertiary/70">{t("copyright")}</div>
        <div className="mt-2 font-mono text-[10px] tracking-label text-text-tertiary/50">
          LIVEMAKERS v{version} · BUILD {sha} · {date}
        </div>
      </div>
    </footer>
  );
}
