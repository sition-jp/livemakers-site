import type { ForecastRuntimeState } from "@/lib/future-atlas/replay";
import type { ForecastContract } from "@/lib/future-atlas/schema";

import { ForecastStatusChip } from "./ForecastStatusChip";

const CONFIDENCE_LABELS = {
  ja: {
    leaning: "有力仮説",
    base_case: "基本シナリオ",
    high_conviction: "高確信",
  },
  en: {
    leaning: "Leaning",
    base_case: "Base case",
    high_conviction: "High conviction",
  },
} as const;

const COPY = {
  ja: {
    title: "未来予測の契約",
    claim: "凍結した主張",
    dueAt: "期日",
    resolutionCriteria: "判定条件",
    confidence: "確信ラベル",
  },
  en: {
    title: "Forecast contract",
    claim: "Frozen claim",
    dueAt: "Due date",
    resolutionCriteria: "Resolution criteria",
    confidence: "Confidence band",
  },
} as const;

export function ArticleContractBlock({
  contract,
  state,
  language,
}: {
  contract: ForecastContract;
  state: ForecastRuntimeState;
  language: "ja" | "en";
}) {
  const copy = COPY[language];

  return (
    <section
      data-atlas-contract={contract.forecastId}
      aria-label={copy.title}
      className="mb-6 border border-border-primary p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-text-tertiary">{contract.forecastId}</p>
          <h2 className="mt-1 text-base font-semibold text-text-primary">{copy.title}</h2>
        </div>
        <ForecastStatusChip status={state.resolutionStatus} />
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-text-tertiary">{copy.claim}</dt>
          <dd className="mt-1 text-text-primary">{contract.claim}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">{copy.dueAt}</dt>
          <dd className="mt-1 text-text-primary">{contract.dueAt}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">{copy.confidence}</dt>
          <dd className="mt-1 text-text-primary">{CONFIDENCE_LABELS[language][contract.confidence]}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-text-tertiary">{copy.resolutionCriteria}</dt>
          <dd className="mt-1 text-text-primary">{contract.resolutionCriteria}</dd>
        </div>
      </dl>
    </section>
  );
}
