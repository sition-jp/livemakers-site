import { Link } from "@/i18n/navigation";
import type { FutureAtlasData } from "@/lib/future-atlas/load";
import type { ForecastRuntimeState } from "@/lib/future-atlas/replay";
import { deriveOverdue, type ForecastSnapshotState } from "@/lib/future-atlas/snapshot";

import { ForecastStatusChip } from "./ForecastStatusChip";

const CONFIDENCE_LABELS = {
  leaning: "リーン",
  base_case: "ベースケース",
  high_conviction: "高確信",
} as const;

export function getForecastSnapshotStates(data: FutureAtlasData): ForecastSnapshotState[] {
  return data.contracts.map((contract) => {
    const state = data.states.get(contract.forecastId);
    if (!state) {
      throw new Error(`missing replay state for ${contract.forecastId}`);
    }
    return { ...state, dueAt: contract.dueAt, confidence: contract.confidence };
  });
}

type ResolutionHistory = Extract<ForecastRuntimeState["history"][number], {
  type: "resolution" | "resolution_correction";
}>;

const getResolutionArticleId = (event: ResolutionHistory): string | undefined =>
  event.type === "resolution" ? event.articleId : event.correctionArticleId;

export function LedgerTable({
  data,
  evaluationDateJst,
}: {
  data: FutureAtlasData;
  evaluationDateJst: string;
}) {
  const contractsByForecastId = new Map(data.contracts.map((contract) => [contract.forecastId, contract]));
  const rows = getForecastSnapshotStates(data).map((state) => deriveOverdue(state, evaluationDateJst));

  if (rows.length === 0) {
    return <p className="border border-border-primary px-4 py-8 text-sm text-text-secondary">登録 0 件</p>;
  }

  return (
    <section aria-label="未来予測台帳" className="space-y-4">
      {rows.map((state) => {
        const contract = contractsByForecastId.get(state.forecastId);
        if (!contract) return null;
        const article = data.articles.get(contract.articleId);
        const withdrawal = state.history.find((event) => event.type === "endorsement_withdrawn");
        const resolutionHistory = state.history.filter(
          (event): event is ResolutionHistory => event.type === "resolution" || event.type === "resolution_correction",
        );
        const resolutionMaterials = resolutionHistory.flatMap((event) => event.materials);
        const resolutionArticles = resolutionHistory
          .map(getResolutionArticleId)
          .filter((articleId): articleId is string => Boolean(articleId));
        const successor = state.supersededByForecastId
          ? contractsByForecastId.get(state.supersededByForecastId)
          : undefined;
        const successorArticle = successor ? data.articles.get(successor.articleId) : undefined;

        return (
          <article key={state.forecastId} className="border border-border-primary p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-xs text-text-tertiary">{state.forecastId}</p>
                <h2 className="mt-1 text-base font-semibold text-text-primary">
                  {article ? <Link href={article.href} className="hover:underline">{article.titleJa}</Link> : contract.articleId}
                </h2>
              </div>
              <ForecastStatusChip status={state.resolutionStatus} />
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-text-tertiary">期日</dt><dd>期日: {contract.dueAt}{state.overdue ? "（期限超過）" : ""}</dd></div>
              <div><dt className="text-text-tertiary">確信度</dt><dd>確信度: {CONFIDENCE_LABELS[contract.confidence]}</dd></div>
              <div><dt className="text-text-tertiary">支持</dt><dd>{state.endorsementStatus === "withdrawn" ? "撤回済み" : "支持中"}</dd></div>
            </dl>

            <div className="mt-5 space-y-4 border-t border-border-primary pt-4 text-sm text-text-secondary">
              <div>
                <h3 className="font-medium text-text-primary">凍結原文</h3>
                <p className="mt-1">{contract.claim}</p>
                <div data-atlas-audit="resolution-sources" className="mt-2">
                  <h4 className="font-medium text-text-primary">判定に使う情報源</h4>
                  <ul className="mt-1 list-disc pl-5">{contract.resolutionSources.map((source) => <li key={source}>{source}</li>)}</ul>
                </div>
              </div>

              {withdrawal && <div data-atlas-audit="withdrawal-reason"><h3 className="font-medium text-text-primary">支持撤回理由</h3><p className="mt-1">{withdrawal.note}</p></div>}

              {resolutionArticles.length > 0 && (
                <div data-atlas-audit="resolution-article">
                  <h3 className="font-medium text-text-primary">判定記事</h3>
                  <ul className="mt-1 list-disc pl-5">{resolutionArticles.map((articleId) => {
                    const resolvedArticle = data.articles.get(articleId);
                    return <li key={articleId}>{resolvedArticle ? <Link href={resolvedArticle.href} className="hover:underline">{resolvedArticle.titleJa}</Link> : articleId}</li>;
                  })}</ul>
                </div>
              )}

              {resolutionMaterials.length > 0 && (
                <div data-atlas-audit="resolution-materials">
                  <h3 className="font-medium text-text-primary">判定資料</h3>
                  <ul className="mt-1 list-disc pl-5">{resolutionMaterials.map((material, index) => <li key={`${material}-${index}`}>{material}</li>)}</ul>
                </div>
              )}

              {resolutionHistory.length > 0 && (
                <div data-atlas-audit="correction-history">
                  <h3 className="font-medium text-text-primary">判定履歴</h3>
                  <ol className="mt-1 list-decimal pl-5">{resolutionHistory.map((event) => <li key={event.eventId}>{event.eventId}: {event.resolutionStatus}</li>)}</ol>
                </div>
              )}

              {successor && (
                <div data-atlas-audit="superseded-by">
                  <h3 className="font-medium text-text-primary">更新版あり</h3>
                  <p className="mt-1">{successorArticle ? <Link href={successorArticle.href} className="hover:underline">{successorArticle.titleJa}</Link> : successor.forecastId}</p>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
