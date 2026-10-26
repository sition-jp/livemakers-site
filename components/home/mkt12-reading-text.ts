import type { HomeCopy } from "@/lib/home/home-copy";
import type { HomeSlots } from "@/lib/home/select-home-slots";

/**
 * 「今朝の12指標」欄の文言とアーカイブ先。2026-08-15 田平氏 GO: 土曜は朝版
 * writer が発火しないため variant="weekend" で週末版を同じ枠に出す (見出し・
 * 文言・アーカイブ先も週末系へ)。PC の中央列 (mkt12-reading) とスマホ
 * (左列の mkt12-card-mobile) の両方がこの 1 か所を使う。
 */
export function mkt12ReadingText(
  variant: HomeSlots["mkt12"]["variant"],
  copy: HomeCopy["mkt12"],
) {
  return variant === "weekend"
    ? {
        title: copy.articleTitleWeekend,
        awaiting: copy.awaitingWeekend,
        previous: copy.previousWeekend,
        archiveHref: "/articles/series/mkt12-weekend",
      }
    : {
        title: copy.articleTitle,
        awaiting: copy.awaiting,
        previous: copy.previous,
        archiveHref: "/articles/series/mkt12-morning",
      };
}
