import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleCardSmall } from "./ArticleCardSmall";

export interface IndexEntryCopy {
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 右カラム②③④ 索引カード (G44 D7)。入口リンク + 最新 1 本 (任意) を示す索引モジュール。
 * 未来アトラス / 週末の12指標 / Weekly Brief で共用する。入口リンク・最新カードともに
 * data-index-nav (INDEX_NAV_MODULES の drift 突合 = R3)。latest が null のとき入口のみ。
 * 最新 1 本は Deep Dive の featured と同じ ArticleCardSmall (16:9 サムネ + 抜粋) で
 * 描く (2026-08-23 田平氏指示 — 旧 ArticleRow はサムネなし)。サムネ未取得時は
 * family 色の同高さ placeholder 帯 (CLS ゼロ・ArticleThumbnail の判断)。
 */
export function IndexEntryCard({
  heading,
  entryHref,
  entryLabel,
  latest,
  copy,
}: {
  heading: string;
  entryHref: string;
  entryLabel: string;
  latest: ArticleMeta | null;
  copy: IndexEntryCopy;
}) {
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text-primary">{heading}</h3>
        <Link
          href={entryHref}
          data-index-nav=""
          className="whitespace-nowrap text-[11px] font-bold text-accent hover:underline"
        >
          {entryLabel}
        </Link>
      </div>
      {latest ? (
        <div className="mt-3">
          <ArticleCardSmall
            article={latest}
            familyLabel={copy.familyLabels[latest.family]}
            indexNav
          />
        </div>
      ) : null}
    </section>
  );
}
