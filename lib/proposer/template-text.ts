import type { Signal } from "@/lib/signals";
import type { IntentSide, PreferredHorizon } from "@/lib/intents";
import { SIDE_JA, HORIZON_JA, SIGNAL_TYPE_JA } from "@/lib/proposer/labels-ja";

type Lang = "ja" | "en";

function requireNonEmpty<T>(arr: T[], fnName: string): void {
  if (arr.length === 0) {
    throw new Error(`${fnName}: signals array must be non-empty`);
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)) + "…";
}

export function buildTitle(args: {
  side: IntentSide;
  primaryAsset: string;
  topSignal: Signal;
  lang: Lang;
}): string {
  const sideLabel = args.lang === "ja" ? SIDE_JA[args.side] : args.side;
  const headline =
    args.lang === "ja"
      ? args.topSignal.headline_ja
      : args.topSignal.headline_en;
  return truncate(`${sideLabel} ${args.primaryAsset}: ${headline}`, 120);
}

/**
 * Precondition: signals.length >= 1 (guaranteed by cluster-detect min_cluster_size).
 */
export function buildThesis(args: {
  signals: Signal[];
  primaryAsset: string;
  side: IntentSide;
  horizon: PreferredHorizon;
  direction: "positive" | "negative" | "neutral" | "mixed";
  lang: Lang;
}): string {
  requireNonEmpty(args.signals, "buildThesis");
  const top = args.signals[0];
  const topSummary = args.lang === "ja" ? top.summary_ja : top.summary_en;
  const sideLabel = args.lang === "ja" ? SIDE_JA[args.side] : args.side;
  const horizonLabel =
    args.lang === "ja" ? HORIZON_JA[args.horizon] : args.horizon;
  const directionLabel =
    args.lang === "ja"
      ? { positive: "好", negative: "売り", neutral: "中立", mixed: "複合" }[
          args.direction
        ]
      : args.direction;

  if (args.signals.length === 1) {
    return truncate(
      `${topSummary} ${args.primaryAsset} に ${sideLabel} の ${horizonLabel} バイアスを示唆する。`,
      500,
    );
  }
  const second = args.signals[1];
  const secondHeadline =
    args.lang === "ja" ? second.headline_ja : second.headline_en;
  return truncate(
    `${topSummary}\n加えて ${secondHeadline} が ${directionLabel} 材料として重なり、` +
      `${args.primaryAsset} に ${sideLabel} の ${horizonLabel} バイアスを示唆する。`,
    500,
  );
}

/**
 * Precondition: signals.length >= 1 (guaranteed by cluster-detect min_cluster_size).
 */
export function buildWhyNow(args: { signals: Signal[]; lang: Lang }): string {
  requireNonEmpty(args.signals, "buildWhyNow");
  const sortedByDate = [...args.signals].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const freshest = sortedByDate[0];
  const date = freshest.created_at.split("T")[0];
  const typeJa = SIGNAL_TYPE_JA[freshest.type] ?? freshest.type;
  const typeLabel = args.lang === "ja" ? typeJa : freshest.type;
  return truncate(
    `${date} に ${typeLabel} 発生。${args.signals.length} 件の裏付け Signal が 72h 以内に集中。`,
    500,
  );
}

/**
 * Precondition: signals.length >= 1 (guaranteed by cluster-detect min_cluster_size).
 */
export function buildDescription(args: {
  signals: Signal[];
  lang: Lang;
}): string {
  requireNonEmpty(args.signals, "buildDescription");
  const summaries = args.signals.map((s) =>
    args.lang === "ja" ? s.summary_ja : s.summary_en,
  );
  return truncate(summaries.join(" / "), 500);
}

export function buildDisplayHeadline(args: {
  topSignal: Signal;
  lang: Lang;
}): string {
  const raw =
    args.lang === "ja"
      ? args.topSignal.headline_ja
      : args.topSignal.headline_en;
  return truncate(raw, 80);
}

/**
 * Precondition: signals.length >= 1 (guaranteed by cluster-detect min_cluster_size).
 */
export function buildDisplaySummary(args: {
  signals: Signal[];
  lang: Lang;
}): string {
  requireNonEmpty(args.signals, "buildDisplaySummary");
  const summaries = args.signals.map((s) =>
    args.lang === "ja" ? s.summary_ja : s.summary_en,
  );
  return truncate(summaries.join(" / "), 240);
}
