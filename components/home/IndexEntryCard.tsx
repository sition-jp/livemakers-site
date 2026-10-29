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
 * `stageLine` は金融再起動の現在地 (restart-map) の段階の 1 行 (2026-10-29 田平氏 GO)。
 * 最新 1 本の下に文字で添える (データ図は小さいと読めないので画像にしない)。
 */
export function IndexEntryCard({
  heading,
  entryHref,
  entryLabel,
  latest,
  copy,
  stageLine = null,
}: {
  heading: string;
  entryHref: string;
  entryLabel: string;
  latest: ArticleMeta | null;
  copy: IndexEntryCopy;
  stageLine?: string | null;
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
          {stageLine ? (
            <p
              data-restart-stages=""
              className="mt-2 text-xs font-semibold leading-relaxed text-text-secondary"
            >
              {stageLine}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
