import type { ArticleFamily } from "@/lib/articles/article-model";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import { ArticleCardSmall } from "./ArticleCardSmall";
import { RadarPromotedCard, type RadarPromotedCopy } from "./RadarPromotedCard";

export interface FlashPromotionCopy {
  sectionTitle: string;
  promoted: RadarPromotedCopy;
  emptyNote: string;
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 左カラム③ 速報→記事化 (G44 D5)。昇格ペアが存在するときは観測を title-only
 * (RadarPromotedCard・data-radar・リンクなし) で示し、その記事は data-radar の外の
 * リンク付きカード (ArticleCardSmall・data-article-id) として並置する。pair が null の
 * ときは空状態プレースホルダを描く (記事リンク・data-article-id は出さない)。
 */
export function FlashPromotionCard({
  pair,
  copy,
}: {
  pair: HomeSlots["radarPair"];
  copy: FlashPromotionCopy;
}) {
  if (!pair) {
    return (
      <section className="rounded-lg border border-dashed border-border-primary bg-bg-secondary p-4">
        <h3 className="text-sm font-bold text-text-primary">
          {copy.sectionTitle}
        </h3>
        <p className="mt-2 text-[11px] text-text-tertiary">{copy.emptyNote}</p>
      </section>
    );
  }
  return (
    <div className="space-y-3">
      <RadarPromotedCard
        observation={pair.observation}
        publishedLabel={pair.article.publishedAtJst.slice(11, 16)}
        copy={copy.promoted}
      />
      <ArticleCardSmall
        article={pair.article}
        familyLabel={copy.familyLabels[pair.article.family]}
      />
    </div>
  );
}
