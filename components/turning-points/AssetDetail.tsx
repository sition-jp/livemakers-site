import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PivotDetail, AssetSymbol, Horizon } from "@/lib/pivots/types";
import { ScoreBadge } from "./ScoreBadge";
import { ConfidenceGradeBadge } from "./ConfidenceGrade";
import { DirectionBiasBar } from "./DirectionBiasBar";
import { EvidenceList } from "./EvidenceList";

const HORIZONS: Horizon[] = ["7D", "30D", "90D"];

export function AssetDetail({
  detail,
  asset,
  selectedHorizon,
}: {
  detail: PivotDetail;
  asset: AssetSymbol;
  selectedHorizon: Horizon;
}) {
  const t = useTranslations("turningPoints.detail");

  return (
    <div className="space-y-10">
      <nav
        aria-label={t("horizon_selector_aria")}
        className="flex items-center gap-2"
      >
        <span className="text-xs uppercase tracking-label text-text-tertiary">
          {t("horizon_label")}
        </span>
        {HORIZONS.map((h) => {
          const isActive = h === selectedHorizon;
          return (
            <Link
              key={h}
              href={`/turning-points/${asset.toLowerCase()}?h=${h}`}
              data-testid={`horizon-link-${h}`}
              className={
                "rounded-sm border px-3 py-1 text-xs uppercase tracking-label transition-colors " +
                (isActive
                  ? "border-pillar-market text-text-primary bg-pillar-market/10"
                  : "border-border-primary text-text-tertiary hover:text-text-primary")
              }
            >
              {h}
            </Link>
          );
        })}
      </nav>

      <section className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-label text-text-tertiary">
            {t("overall_label")}
          </p>
          <ScoreBadge score={detail.scores.overall} size="lg" showLevel />
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-label text-text-tertiary mb-1">
              {t("price_pivot_label")}
            </p>
            <ScoreBadge score={detail.scores.price_pivot} size="md" showLevel />
          </div>
          <div>
            <p className="text-xs uppercase tracking-label text-text-tertiary mb-1">
              {t("volatility_pivot_label")}
            </p>
            <ScoreBadge
              score={detail.scores.volatility_pivot}
              size="md"
              showLevel
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-label text-text-tertiary mb-3">
          {t("direction_bias_label")}
        </h2>
        <DirectionBiasBar bias={detail.direction_bias} />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-label text-text-tertiary mb-3">
          {t("confidence_label")}
        </h2>
        <ConfidenceGradeBadge
          grade={detail.scores.confidence.grade}
          score={detail.scores.confidence.score}
        />
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-label text-text-secondary mb-2">
          {t("summary_label")}
        </h2>
        <p className="text-lg text-text-primary mb-2">
          {detail.summary.headline}
        </p>
        <p className="text-sm text-text-secondary leading-relaxed max-w-prose">
          {detail.summary.explanation}
        </p>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-label text-text-secondary mb-3">
          {t("evidence_label")}
        </h2>
        <EvidenceList items={detail.evidence} />
      </section>
    </div>
  );
}
