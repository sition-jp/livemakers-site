import { useTranslations } from "next-intl";

import type { ForecastRuntimeState } from "@/lib/future-atlas/replay";
import type { ForecastContract } from "@/lib/future-atlas/schema";

import { ForecastStatusChip } from "./ForecastStatusChip";

export function ArticleContractBlock({
  contract,
  state,
}: {
  contract: ForecastContract;
  state: ForecastRuntimeState;
}) {
  const t = useTranslations("futureAtlas.contract");
  const confidence = useTranslations("futureAtlas.confidence");

  return (
    <section
      data-atlas-contract={contract.forecastId}
      aria-label={t("title")}
      className="mb-6 border border-border-primary p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-text-tertiary">{contract.forecastId}</p>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{t("title")}</h2>
        </div>
        <ForecastStatusChip status={state.resolutionStatus} />
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-text-tertiary">{t("claim")}</dt>
          <dd className="mt-1 text-text-primary">{contract.claim}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">{t("dueAt")}</dt>
          <dd className="mt-1 text-text-primary">{contract.dueAt}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">{t("confidence")}</dt>
          <dd className="mt-1 text-text-primary">{confidence(contract.confidence)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-text-tertiary">{t("resolutionCriteria")}</dt>
          <dd className="mt-1 text-text-primary">{contract.resolutionCriteria}</dd>
        </div>
      </dl>
    </section>
  );
}
