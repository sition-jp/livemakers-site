import { scoreLevel, type ScoreLevel } from "@/lib/pivots/types";

const LEVEL_CLASS: Record<ScoreLevel, string> = {
  Low: "text-text-tertiary",
  Medium: "text-pillar-overview",
  High: "text-pillar-market",
  Extreme: "text-status-up",
};

export interface ScoreBadgeProps {
  score: number;
  showLevel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({
  score,
  showLevel = true,
  size = "md",
}: ScoreBadgeProps) {
  const level = scoreLevel(score);
  const sizeClass =
    size === "lg"
      ? "text-5xl font-light"
      : size === "sm"
        ? "text-base font-medium"
        : "text-2xl font-medium";

  return (
    <span className={`inline-flex items-baseline gap-2 ${LEVEL_CLASS[level]}`}>
      <span className={sizeClass} data-testid="score-value">
        {Math.round(score)}
      </span>
      {showLevel && (
        <span
          className="text-xs uppercase tracking-label"
          data-testid="score-level"
        >
          {level}
        </span>
      )}
    </span>
  );
}
