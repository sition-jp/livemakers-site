import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleRow } from "@/components/home/ArticleRow";
import { buildAtlasEntry } from "@/lib/home/atlas-entry";

/**
 * 記事詳細の 9 カテゴリ索引レール (G44 D9)。並び順は spec §4 で固定し、現在記事の
 * シリーズ枠だけを「このシリーズの他の記事」として先頭へ移す (9 カテゴリ総数は不変)。
 * - ① Session Terminal は入口リンクのみ (session family 記事は catalog に無い前提・P3-8)。
 * - ⑦ 未来アトラスは D4 と同じ flag 単一導出 (buildAtlasEntry・G46 §11.3)。
 * - 件数 = Deep Dive のみ 5 本・他は各 1 本。全リンクは索引意味論 (data-index-nav)。
 */

export const RAIL_SECTIONS = [
  "session-terminal",
  "daily-intel",
  "signal",
  "deep-dive",
  "mkt12-morning",
  "event-risk-radar",
  "future-atlas",
  "mkt12-weekend",
  "weekly-brief",
] as const;
export type RailSection = (typeof RAIL_SECTIONS)[number];

const SECTION_FAMILY: Partial<Record<RailSection, ArticleFamily>> = {
  "daily-intel": "daily-intel",
  signal: "signal",
  "deep-dive": "deep-dive",
  "mkt12-morning": "mkt12-morning",
  "event-risk-radar": "event-risk-radar",
  "future-atlas": "future-map",
  "mkt12-weekend": "mkt12-weekend",
  "weekly-brief": "weekly-brief",
};

const SECTION_COUNT: Partial<Record<RailSection, number>> = {
  "deep-dive": 5,
};

export interface SeriesRailCopy {
  railTitle: string;
  currentSeriesTitle: string;
  viewAll: string;
  sessionTerminalHeading: string;
  sessionTerminalEntry: string;
  atlasPublishedHeading: string;
  atlasUnpublishedHeading: string;
  familyLabels: Record<ArticleFamily, string>;
}

const sectionForFamily = (family: ArticleFamily): RailSection | null => {
  const entry = (Object.entries(SECTION_FAMILY) as [RailSection, ArticleFamily][]).find(
    ([, candidate]) => candidate === family,
  );
  return entry ? entry[0] : null;
};

function RailArticleList({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: SeriesRailCopy;
}) {
  if (articles.length === 0) return null;
  return (
    <div className="mt-1 border-t border-border-primary">
      {articles.map((article) => (
        <ArticleRow
          key={article.articleId}
          article={article}
          familyLabel={copy.familyLabels[article.family]}
          indexNav
        />
      ))}
    </div>
  );
}

export function SeriesRail({
  articles,
  current,
  surfacePublished,
  copy,
}: {
  articles: ArticleMeta[];
  current: ArticleMeta;
  surfacePublished: boolean;
  copy: SeriesRailCopy;
}) {
  const byNewest = (left: ArticleMeta, right: ArticleMeta): number =>
    right.publishedAtJst.localeCompare(left.publishedAtJst);
  const ofFamily = (family: ArticleFamily, count: number, excludeCurrent: boolean) =>
    articles
      .filter(
        (candidate) =>
          candidate.family === family &&
          (!excludeCurrent || candidate.articleId !== current.articleId),
      )
      .toSorted(byNewest)
      .slice(0, count);

  const currentSection = sectionForFamily(current.family);
  const order: RailSection[] = currentSection
    ? [currentSection, ...RAIL_SECTIONS.filter((section) => section !== currentSection)]
    : [...RAIL_SECTIONS];

  const atlas = buildAtlasEntry(
    surfacePublished,
    ofFamily("future-map", 1, false)[0] ?? null,
  );

  return (
    <aside
      data-article-rail=""
      data-index-nav=""
      className="mt-12 min-w-0 border-t border-border-primary pt-6 lg:mt-0 lg:border-t-0 lg:pt-0"
      aria-label={copy.railTitle}
    >
      <p className="mb-3 text-[11px] font-bold tracking-label text-text-tertiary">
        {copy.railTitle}
      </p>
      <div className="space-y-4">
        {order.map((section) => {
          const isCurrent = section === currentSection;
          const family = SECTION_FAMILY[section];
          const count = SECTION_COUNT[section] ?? 1;

          let heading: string;
          let entryHref: string;
          if (section === "session-terminal") {
            heading = copy.sessionTerminalHeading;
            entryHref = "/sessions/archive";
          } else if (section === "future-atlas") {
            heading = surfacePublished
              ? copy.atlasPublishedHeading
              : copy.atlasUnpublishedHeading;
            entryHref = atlas.href;
          } else if (section === "weekly-brief") {
            heading = copy.familyLabels["weekly-brief"];
            entryHref = "/brief";
          } else {
            heading = copy.familyLabels[family!];
            entryHref = `/articles/series/${family}`;
          }

          const rows =
            section === "session-terminal"
              ? []
              : section === "future-atlas"
                ? (isCurrent
                    ? ofFamily("future-map", count, true)
                    : atlas.latest
                      ? [atlas.latest]
                      : [])
                : ofFamily(family!, count, isCurrent);

          return (
            <section
              key={section}
              data-rail-section={section}
              className="rounded-lg border border-border-primary bg-bg-secondary p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-text-primary">
                  {isCurrent ? copy.currentSeriesTitle : heading}
                </h2>
                <Link
                  href={entryHref}
                  className="whitespace-nowrap text-[11px] font-bold text-accent hover:underline"
                >
                  {section === "session-terminal"
                    ? copy.sessionTerminalEntry
                    : copy.viewAll}
                </Link>
              </div>
              <RailArticleList articles={rows} copy={copy} />
            </section>
          );
        })}
      </div>
    </aside>
  );
}

export function buildTestSeriesRailCopy(): SeriesRailCopy {
  return {
    railTitle: "ほかのシリーズ",
    currentSeriesTitle: "このシリーズの他の記事",
    viewAll: "一覧を見る",
    sessionTerminalHeading: "Session Terminal",
    sessionTerminalEntry: "アーカイブを見る",
    atlasPublishedHeading: "未来アトラス",
    atlasUnpublishedHeading: "未来の地図",
    familyLabels: {
      "daily-intel": "Daily Intel",
      signal: "Signal",
      "deep-dive": "Deep Dive",
      "future-map": "未来アトラス",
      "mkt12-morning": "朝の12指標",
      "mkt12-weekend": "週末の12指標",
      "event-risk-radar": "Event Risk Radar",
      "weekly-brief": "Weekly Brief",
      session: "セッション記事",
    },
  };
}
