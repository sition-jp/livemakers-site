import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import type { RadarObservation } from "@/lib/home/radar-observations";
import { ArticleCardSmall } from "./ArticleCardSmall";
import {
  RadarObservationsCard,
  type RadarObservationsCopy,
} from "./RadarObservationsCard";

export interface EventRiskCopy {
  observations: RadarObservationsCopy;
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 左カラム⑤ Event Risk (G44 D5)。観測中の項目を title-only (RadarObservationsCard・
 * data-radar・リンクなし) で束ね、最新の event-risk-radar 記事 1 本を data-radar の外の
 * リンク付きカード (ArticleCardSmall・data-article-id) として添える。
 */
export function EventRiskCard({
  observations,
  latest,
  copy,
}: {
  observations: readonly RadarObservation[];
  latest: ArticleMeta | null;
  copy: EventRiskCopy;
}) {
  return (
    <div className="space-y-3">
      <RadarObservationsCard
        observations={observations}
        copy={copy.observations}
      />
      {latest ? (
        <ArticleCardSmall
          article={latest}
          familyLabel={copy.familyLabels[latest.family]}
        />
      ) : null}
    </div>
  );
}
