import { describe, expect, it } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import { REGION_MODULES } from "@/lib/home/gradient-ledger";
import {
  LAGGING_ARTICLE_MODULES,
  laggingModuleLatest,
  orderLaggingModules,
  type LaggingLatestSlots,
} from "@/lib/home/lagging-order";

const mk = (
  articleId: string,
  family: ArticleMeta["family"],
  publishedAtJst: string,
): ArticleMeta => ({
  articleId,
  family,
  titleJa: articleId,
  publishedAtJst,
  publishedLabel: publishedAtJst.slice(5, 16),
  lanes: [],
  href: `/articles/${articleId}`,
});

// 2026-08-23 (土) の本番実測に倣う: 地図 10:37 > 週末12指標 09:38 > Brief 07:55 > Deep Dive 08-15
const saturday: LaggingLatestSlots = {
  deepDives: [
    mk("dd-0815", "deep-dive", "2026-08-15T13:59:00+09:00"),
    mk("dd-0814", "deep-dive", "2026-08-14T21:00:00+09:00"),
  ],
  atlasLatest: mk("fm-0822", "future-map", "2026-08-22T10:37:00+09:00"),
  mkt12WeekendLatest: mk("we-0822", "mkt12-weekend", "2026-08-22T09:38:00+09:00"),
  weeklyBriefLatest: mk("wb-0822", "weekly-brief", "2026-08-22T07:55:00+09:00"),
};

describe("lagging-order (2026-08-23 田平氏 GO A: 記事 4 枠は新着順・末尾 2 枠固定)", () => {
  it("names exactly the four article modules of the lagging ledger", () => {
    expect([...LAGGING_ARTICLE_MODULES]).toEqual([
      "deep-dive",
      "atlas-entry",
      "mkt12-weekend",
      "weekly-brief",
    ]);
    for (const module of LAGGING_ARTICLE_MODULES) {
      expect(REGION_MODULES.lagging).toContain(module);
    }
  });

  it("resolves each module to its latest article (deep-dive = featured head)", () => {
    expect(laggingModuleLatest(saturday, "deep-dive")?.articleId).toBe("dd-0815");
    expect(laggingModuleLatest(saturday, "atlas-entry")?.articleId).toBe("fm-0822");
    expect(laggingModuleLatest(saturday, "mkt12-weekend")?.articleId).toBe("we-0822");
    expect(laggingModuleLatest(saturday, "weekly-brief")?.articleId).toBe("wb-0822");
    expect(laggingModuleLatest({ ...saturday, deepDives: [] }, "deep-dive")).toBeNull();
  });

  it("orders the four article modules newest-first and keeps the ledger tail fixed", () => {
    expect(orderLaggingModules(saturday)).toEqual([
      "atlas-entry",
      "mkt12-weekend",
      "weekly-brief",
      "deep-dive",
      "latest-articles",
      "turning-point-reserved",
    ]);
  });

  it("always returns a permutation of the lagging ledger", () => {
    const ordered = orderLaggingModules(saturday);
    expect(ordered).toHaveLength(REGION_MODULES.lagging.length);
    expect([...ordered].sort()).toEqual([...REGION_MODULES.lagging].sort());
  });

  it("pushes modules without an article to the end of the article block, in ledger order", () => {
    const sparse: LaggingLatestSlots = {
      ...saturday,
      atlasLatest: null,
      weeklyBriefLatest: null,
    };
    expect(orderLaggingModules(sparse)).toEqual([
      "mkt12-weekend",
      "deep-dive",
      "atlas-entry",
      "weekly-brief",
      "latest-articles",
      "turning-point-reserved",
    ]);
  });

  it("falls back to ledger order on equal timestamps", () => {
    const same = "2026-08-22T09:00:00+09:00";
    const tied: LaggingLatestSlots = {
      deepDives: [mk("dd", "deep-dive", same)],
      atlasLatest: mk("fm", "future-map", same),
      mkt12WeekendLatest: mk("we", "mkt12-weekend", same),
      weeklyBriefLatest: mk("wb", "weekly-brief", same),
    };
    expect(orderLaggingModules(tied)).toEqual([...REGION_MODULES.lagging]);
  });

  it("matches the ledger when every module is empty", () => {
    const empty: LaggingLatestSlots = {
      deepDives: [],
      atlasLatest: null,
      mkt12WeekendLatest: null,
      weeklyBriefLatest: null,
    };
    expect(orderLaggingModules(empty)).toEqual([...REGION_MODULES.lagging]);
  });

  it("does not mutate the ledger", () => {
    const before = [...REGION_MODULES.lagging];
    orderLaggingModules(saturday);
    expect(REGION_MODULES.lagging).toEqual(before);
  });
});
