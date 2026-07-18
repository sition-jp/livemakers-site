import type { ForecastRuntimeState } from "@/lib/future-atlas/replay";
import type { ForecastContract } from "@/lib/future-atlas/schema";

export type ForecastSnapshotState = ForecastRuntimeState
  & Pick<ForecastContract, "dueAt" | "confidence">;

export type ForecastSnapshotWithOverdue = ForecastSnapshotState & {
  overdue: boolean;
};

export type LedgerSummary = {
  total: number;
  open: number;
  overdue: number;
  trueCount: number;
  falseCount: number;
  indeterminate: number;
  voidCount: number;
  withdrawn: number;
  binaryResolved: number;
  hitRate: number | null;
  nonBinaryResolutionRate: number | null;
  warnings: string[];
};

const addDays = (isoDate: string, days: number): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

export const currentJstDate = (now = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
};

export const deriveOverdue = (
  state: ForecastSnapshotState,
  evaluationDateJst: string,
): ForecastSnapshotWithOverdue => ({
  ...state,
  overdue: state.resolutionStatus === "open" && evaluationDateJst > addDays(state.dueAt, 14),
});

export const buildLedgerSummary = (
  states: Iterable<ForecastSnapshotState>,
  evaluationDateJst: string,
): LedgerSummary => {
  const snapshot = Array.from(states, (state) => deriveOverdue(state, evaluationDateJst));
  const countResolution = (status: ForecastRuntimeState["resolutionStatus"]) =>
    snapshot.filter((state) => state.resolutionStatus === status).length;

  const open = countResolution("open");
  const trueCount = countResolution("true");
  const falseCount = countResolution("false");
  const indeterminate = countResolution("indeterminate");
  const voidCount = countResolution("void");
  const binaryResolved = trueCount + falseCount;
  const allResolved = binaryResolved + indeterminate + voidCount;
  const highConvictionOpen = snapshot.filter(
    (state) => state.resolutionStatus === "open" && state.confidence === "high_conviction",
  ).length;

  return {
    total: snapshot.length,
    open,
    overdue: snapshot.filter((state) => state.overdue).length,
    trueCount,
    falseCount,
    indeterminate,
    voidCount,
    withdrawn: snapshot.filter((state) => state.endorsementStatus === "withdrawn").length,
    binaryResolved,
    hitRate: binaryResolved >= 10 ? trueCount / binaryResolved : null,
    nonBinaryResolutionRate: allResolved > 0 ? (indeterminate + voidCount) / allResolved : null,
    warnings: open > 0 && highConvictionOpen / open > 1 / 3
      ? ["high_conviction_share_exceeded"]
      : [],
  };
};
