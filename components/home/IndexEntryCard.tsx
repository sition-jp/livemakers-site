import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleRow } from "./ArticleRow";

export interface IndexEntryCopy {
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 右カラム②③④ 索引カード (G44 D7)。入口リンク + 最新 1 本 (任意) を示す索引モジュール。
 * 未来アトラス / 週末の12指標 / Weekly Brief で共用する。入口リンク・最新行ともに
 * data-index-nav (INDEX_NAV_MODULES の drift 突合 = R3)。latest が null のとき入口のみ。
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
        <div className="mt-2 border-t border-border-primary">
          <ArticleRow
            article={latest}
            familyLabel={copy.familyLabels[latest.family]}
            indexNav
          />
        </div>
      ) : null}
    </section>
  );
}
