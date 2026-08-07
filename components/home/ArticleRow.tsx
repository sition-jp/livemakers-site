import { Link } from "@/i18n/navigation";
import type {
  ArticleFamily,
  ArticleLane,
  ArticleMeta,
} from "@/lib/articles/article-model";

export const FAMILY_COLORS: Record<ArticleFamily, string> = {
  "daily-intel": "var(--lmk-family-intel)",
  signal: "var(--lmk-family-signal)",
  "deep-dive": "var(--lmk-family-deep-dive)",
  "future-map": "var(--lmk-family-future-map)",
  "mkt12-morning": "var(--lmk-family-mkt12)",
  "mkt12-weekend": "var(--lmk-family-mkt12-weekend)",
  "event-risk-radar": "var(--lmk-family-event-risk)",
  "weekly-brief": "var(--lmk-family-weekly-brief)",
  session: "var(--lmk-family-session)",
  "future-atlas": "var(--lmk-family-future-map)",
};

/**
 * 勾配カラム共通の記事行 (G44 D11 / G48 D4 でレイアウト B へ)。サムネなし。
 * レイアウト B = タイトルを全幅で先頭に置き、シリーズ色チップ・日付・lanes を
 * メタ行として下段にまとめる。幅に依存せず折り返しが破綻せず、タイトル左端が
 * 揃うため走査しやすい (本番 294px レールでタイトル可用幅 104px -> 270px の実測)。
 * - `laneLabels` を渡すと article.lanes をメタ行の小さなタグで表示する (任意)。
 * - `indexNav` を渡すと data-index-nav をアンカーに付与し、articleId 重複検査
 *   (gate 6) から除外する (索引系モジュールの行に使う)。既存呼び出し面は両プロップ
 *   未指定で従来どおり描画される (props は G44 から不変)。
 */
export function ArticleRow({
  article,
  familyLabel,
  indexNav = false,
  laneLabels,
}: {
  article: ArticleMeta;
  familyLabel: string;
  indexNav?: boolean;
  laneLabels?: Record<ArticleLane, string>;
}) {
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      data-index-nav={indexNav ? "" : undefined}
      className="group block border-b border-border-primary px-3 py-2.5 text-left transition-colors hover:bg-bg-tertiary"
    >
      <span
        data-testid="article-row-title"
        className="block text-sm font-semibold text-text-primary group-hover:underline"
      >
        {article.titleJa}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-2">
        <span
          data-testid="article-row-chip"
          className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-label"
          style={{
            borderColor: FAMILY_COLORS[article.family],
            color: FAMILY_COLORS[article.family],
          }}
        >
          {familyLabel}
        </span>
        <time className="whitespace-nowrap font-mono text-[10px] text-text-tertiary">
          {article.publishedLabel}
        </time>
        {laneLabels && article.lanes.length > 0
          ? article.lanes.map((lane) => (
              <span
                key={lane}
                className="rounded-sm bg-bg-tertiary px-1 py-0.5 text-[8px] font-bold tracking-label text-text-tertiary"
              >
                {laneLabels[lane]}
              </span>
            ))
          : null}
      </span>
    </Link>
  );
}
