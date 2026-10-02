import type { ReactNode } from "react";

import { LatestArticlesCard } from "@/components/home/LatestArticlesCard";
import type { LatestArticlesRailData } from "@/lib/articles/latest-articles-rail";

/**
 * 一覧ページの 2 カラム枠 (2026-10-02 田平氏指示)。左 = ページ本体 (children)・
 * 右 = 「最新の記事」20 本 (ホーム右カラム⑤と同じ LatestArticlesCard)。
 * 寸法は記事詳細の右レール (max-w 1200 / 右 360px) と揃える。lg 未満は本体の下へ回る。
 * 行は LatestArticlesCard 側で indexNav (data-index-nav) 付き = 索引扱い。
 */
export function LatestArticlesRailLayout({
  rail,
  children,
}: {
  rail: LatestArticlesRailData;
  children: ReactNode;
}) {
  return (
    <div
      data-latest-rail-layout=""
      className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8"
    >
      {children}
      <aside
        data-latest-articles-rail=""
        aria-label={rail.copy.title}
        className="mt-12 min-w-0 lg:mt-0"
      >
        <LatestArticlesCard articles={rail.articles} copy={rail.copy} />
      </aside>
    </div>
  );
}
