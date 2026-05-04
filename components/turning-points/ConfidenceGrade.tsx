import type { ConfidenceGrade } from "@/lib/pivots/types";

const GRADE_CLASS: Record<ConfidenceGrade, string> = {
  A: "text-status-up",
  "B+": "text-pillar-market",
  B: "text-pillar-overview",
  C: "text-text-tertiary",
};

export function ConfidenceGradeBadge({
  grade,
  score,
}: {
  grade: ConfidenceGrade;
  score?: number;
}) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span
        className={`text-xl font-medium ${GRADE_CLASS[grade]}`}
        data-testid="confidence-grade"
      >
        {grade}
      </span>
      {typeof score === "number" && (
        <span className="text-xs text-text-tertiary tracking-label">
          {Math.round(score)}/100
        </span>
      )}
    </span>
  );
}
