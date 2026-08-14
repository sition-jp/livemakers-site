import { FAMILY_COLORS } from "@/components/home/ArticleRow";
import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * 記事サムネ表示枠 (INFLOW-G2 T1a・D4)。
 *
 * - present: 検証済み Blob URL の 16:9 画像 (alt = 記事タイトル)
 * - placeholder: family 色のグラデーション帯 (画像未取得でも記事は掲載を継続
 *   する — doctrine Amendment 2026-08-07 の mirror lane 例外)
 *
 * variant:
 * - "fixed": aspect-[16/9] の固定枠を常時確保する (ArticleCardSmall /
 *   detail hero)。present/placeholder で高さが変わらない = CLS ゼロ
 * - "lead": LeadArticleCard の現行 placeholder 帯 (h-24) を維持し、
 *   present のときは 21:9 の短い枠に中央 crop する (2026-08-14 Phase 3
 *   田平氏 GO — Daily Intel / 12指標 hero のサムネ高さ圧縮。object-cover
 *   は既定で中央基準なので上下が均等に切れる)
 *
 * `data-article-thumbnail="present|placeholder"` は QA / observer の観測属性。
 */
export function ArticleThumbnail({
  thumbnailUrl,
  family,
  title,
  variant,
  className = "",
}: {
  thumbnailUrl: string | undefined;
  family: ArticleMeta["family"];
  title: string;
  variant: "fixed" | "lead";
  className?: string;
}) {
  const placeholderStyle = {
    background: `linear-gradient(120deg, ${FAMILY_COLORS[family]}, transparent)`,
  };
  if (thumbnailUrl) {
    return (
      <div
        data-article-thumbnail="present"
        className={`${variant === "lead" ? "aspect-[21/9]" : "aspect-[16/9]"} overflow-hidden ${className}`}
      >
        {/* Blob origin は next/image の許可リスト外運用のため素の img を使う
            (detail hero の既存判断と同じ)。width/height 指定で枠を予約 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt={title}
          width={1600}
          height={900}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      data-article-thumbnail="placeholder"
      className={`${variant === "fixed" ? "aspect-[16/9]" : "h-24"} opacity-80 ${className}`}
      style={placeholderStyle}
    />
  );
}
