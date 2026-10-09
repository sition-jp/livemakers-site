import { describe, expect, it } from "vitest";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { selectSignalTimeline } from "@/lib/home/select-signal-timeline";

const NOW = new Date("2026-07-10T12:00:00+09:00"); // 24h window = [07-09 12:00, 07-10 12:00]

function mk(
  articleId: string,
  publishedAtJst: string,
  family: ArticleMeta["family"] = "signal",
): ArticleMeta {
  return {
    articleId,
    family,
    titleJa: articleId,
    publishedAtJst,
    publishedLabel: publishedAtJst.slice(5, 16),
    lanes: [],
    href: `/articles/${articleId}`,
  };
}

const ids = (list: ArticleMeta[]): string[] => list.map((a) => a.articleId);

describe("selectSignalTimeline", () => {
  it("places landmark (節目シグナル) articles in the same timeline as signal (2026-10-03)", () => {
    const result = selectSignalTimeline({
      articles: [
        mk("sig", "2026-07-10T10:00:00+09:00"),
        mk("lm", "2026-07-10T11:00:00+09:00", "landmark"),
        mk("dd", "2026-07-10T09:00:00+09:00", "deep-dive"),
      ],
      now: NOW,
    });
    expect(ids(result)).toEqual(["lm", "sig"]);
  });

  it("returns all signals within 24h when they exceed the floor", () => {
    // 21 signals (floor 20 + 1), hourly from 07-10 11:00 back to 07-09 14:00 —
    // all inside the 24h window [07-09 12:00, 07-10 12:00], descending
    const within = Array.from({ length: 21 }, (_, index) =>
      mk(
        `w${String(index).padStart(2, "0")}`,
        new Date(Date.parse("2026-07-10T11:00:00+09:00") - index * 3_600_000)
          .toISOString(),
      ),
    );
    const result = selectSignalTimeline({ articles: within, now: NOW });
    expect(result).toHaveLength(21); // floor is a minimum, not a cap
    expect(result.every((a) => a.family === "signal")).toBe(true);
    // descending publishedAtJst order preserved
    const sorted = [...result].sort((a, b) =>
      b.publishedAtJst.localeCompare(a.publishedAtJst),
    );
    expect(ids(result)).toEqual(ids(sorted));
  });

  it("pads with the newest older signals up to the floor (20) when the 24h window is thin", () => {
    const within = [
      mk("w1", "2026-07-10T10:00:00+09:00"),
      mk("w2", "2026-07-10T08:00:00+09:00"),
      mk("w3", "2026-07-09T14:00:00+09:00"),
    ];
    // 19 older signals, every 6h back from 07-09 10:00 (outside the window), descending
    const older = Array.from({ length: 19 }, (_, index) =>
      mk(
        `o${index + 1}`,
        new Date(Date.parse("2026-07-09T10:00:00+09:00") - index * 6 * 3_600_000)
          .toISOString(),
      ),
    );
    const result = selectSignalTimeline({ articles: [...within, ...older], now: NOW });
    expect(result).toHaveLength(20); // 3 in-window + 17 newest older
    expect(ids(result).slice(0, 3)).toEqual(["w1", "w2", "w3"]);
    expect(ids(result).slice(3)).toEqual(ids(older.slice(0, 17)));
    expect(ids(result)).not.toContain("o18"); // beyond the floor
  });

  it("excludes promoted-pair ids before applying the floor", () => {
    const articles = [
      mk("a", "2026-07-10T10:00:00+09:00"), // within, but excluded
      mk("b", "2026-07-10T09:00:00+09:00"), // within
      mk("c", "2026-07-09T10:00:00+09:00"), // older
      mk("d", "2026-07-08T10:00:00+09:00"), // older
    ];
    const result = selectSignalTimeline({
      articles,
      now: NOW,
      floor: 3,
      excludeIds: ["a"],
    });
    expect(ids(result)).toEqual(["b", "c", "d"]);
    expect(ids(result)).not.toContain("a");
  });

  it("never returns non-signal families", () => {
    const articles = [
      mk("sig1", "2026-07-10T10:00:00+09:00", "signal"),
      mk("di", "2026-07-10T09:00:00+09:00", "daily-intel"),
      mk("dd", "2026-07-09T20:00:00+09:00", "deep-dive"),
      mk("sig2", "2026-07-08T10:00:00+09:00", "signal"),
    ];
    const result = selectSignalTimeline({ articles, now: NOW });
    expect(result.every((a) => a.family === "signal")).toBe(true);
    expect(ids(result)).toEqual(["sig1", "sig2"]);
  });
});
