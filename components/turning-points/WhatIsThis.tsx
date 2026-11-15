import { useTranslations } from "next-intl";

export function WhatIsThis() {
  const t = useTranslations("turningPoints.v2.whatIsThis");
  return (
    <details open data-testid="what-is-this" className="rounded border border-border-primary p-4">
      <summary className="cursor-pointer font-semibold text-text-primary">{t("title")}</summary>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-text-secondary">
        <li>
          <b className="text-text-primary">{t("band.lead")}</b>
          {t("band.body")}
        </li>
        <li>
          <b className="text-text-primary">{t("pct.lead")}</b>
          {t("pct.body")}
        </li>
        <li>
          <b className="text-text-primary">{t("long.lead")}</b>
          {t("long.body")}
        </li>
        <li>
          <b className="text-text-primary">{t("midNear.leadMid")}</b>
          {t("midNear.bodyMid")}
          <b className="text-text-primary">{t("midNear.leadNear")}</b>
          {t("midNear.bodyNear")}
        </li>
        <li>
          <b className="text-text-primary">{t("turn.lead")}</b>
          {t("turn.body")}
        </li>
      </ul>
    </details>
  );
}
