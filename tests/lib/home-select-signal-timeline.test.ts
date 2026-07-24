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
  it("returns all signals within 24h when they exceed the floor", () => {
    // 11 signals, all inside the 24h window [07-09 12:00, 07-10 12:00], descending
    const within = [
      mk("w00", "2026-07-10T11:00:00+09:00"),
      mk("w01", "2026-07-10T10:00:00+09:00"),
      mk("w02", "2026-07-10T09:00:00+09:00"),
      mk("w03", "2026-07-10T08:00:00+09:00"),
      mk("w04", "2026-07-10T07:00:00+09:00"),
      mk("w05", "2026-07-10T06:00:00+09:00"),
      mk("w06", "2026-07-09T22:00:00+09:00"),
      mk("w07", "2026-07-09T20:00:00+09:00"),
      mk("w08", "2026-07-09T18:00:00+09:00"),
      mk("w09", "2026-07-09T15:00:00+09:00"),
      mk("w10", "2026-07-09T13:00:00+09:00"),
    ];
    const result = selectSignalTimeline({ articles: within, now: NOW });
    expect(result).toHaveLength(11); // floor is a minimum, not a cap
    expect(result.every((a) => a.family === "signal")).toBe(true);
    // descending publishedAtJst order preserved
    const sorted = [...result].sort((a, b) =>
      b.publishedAtJst.localeCompare(a.publishedAtJst),
    );
    expect(ids(result)).toEqual(ids(sorted));
  });

  it("pads with the newest older signals up to the floor when the 24h window is thin", () => {
    const within = [
      mk("w1", "2026-07-10T10:00:00+09:00"),
      mk("w2", "2026-07-10T08:00:00+09:00"),
      mk("w3", "2026-07-09T14:00:00+09:00"),
    ];
    const older = [
      mk("o1", "2026-07-09T10:00:00+09:00"),
      mk("o2", "2026-07-09T08:00:00+09:00"),
      mk("o3", "2026-07-08T20:00:00+09:00"),
      mk("o4", "2026-07-08T16:00:00+09:00"),
      mk("o5", "2026-07-08T10:00:00+09:00"),
      mk("o6", "2026-07-07T20:00:00+09:00"),
      mk("o7", "2026-07-07T12:00:00+09:00"),
      mk("o8", "2026-07-06T20:00:00+09:00"),
      mk("o9", "2026-07-06T10:00:00+09:00"),
      mk("o10", "2026-07-05T20:00:00+09:00"),
      mk("o11", "2026-07-05T10:00:00+09:00"),
      mk("o12", "2026-07-04T20:00:00+09:00"),
    ];
    const result = selectSignalTimeline({ articles: [...within, ...older], now: NOW });
    expect(result).toHaveLength(10); // 3 in-window + 7 newest older
    expect(ids(result).slice(0, 3)).toEqual(["w1", "w2", "w3"]);
    expect(ids(result).slice(3)).toEqual(["o1", "o2", "o3", "o4", "o5", "o6", "o7"]);
    expect(ids(result)).not.toContain("o8"); // beyond the floor
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
