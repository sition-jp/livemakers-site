import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  formatDurationJa,
  getAllVideos,
  getLatestPostedVideo,
  getPostedVideoForArticle,
  getVideoBySlug,
  groupSourcesByChapter,
  timestampToSeconds,
  youtubeWatchUrl,
} from "@/lib/videos";

const EP001 = "ep001-finance-reboot";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** ep001 を一時ディレクトリへ写し、video.json / sources.json を書き換えた contentDir を返す */
function mutatedDir(mutate: (meta: Record<string, unknown>) => void): string {
  const contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "videos-"));
  tempDirs.push(contentDir);
  const to = path.join(contentDir, EP001);
  fs.cpSync(path.join(process.cwd(), "content", "videos", EP001), to, { recursive: true });
  const meta = JSON.parse(fs.readFileSync(path.join(to, "video.json"), "utf8"));
  mutate(meta);
  fs.writeFileSync(path.join(to, "video.json"), JSON.stringify(meta));
  return contentDir;
}

/** ep001 を一時ディレクトリへ写し、video.json / sources.json を書き換えて読む */
function loadMutated(mutate: (meta: Record<string, unknown>, sources: Record<string, unknown>) => void) {
  const contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "videos-"));
  tempDirs.push(contentDir);
  const from = path.join(process.cwd(), "content", "videos", EP001);
  const to = path.join(contentDir, EP001);
  fs.cpSync(from, to, { recursive: true });
  const meta = JSON.parse(fs.readFileSync(path.join(to, "video.json"), "utf8"));
  const sources = JSON.parse(fs.readFileSync(path.join(to, "sources.json"), "utf8"));
  mutate(meta, sources);
  fs.writeFileSync(path.join(to, "video.json"), JSON.stringify(meta));
  fs.writeFileSync(path.join(to, "sources.json"), JSON.stringify(sources));
  return () => getAllVideos({ contentDir });
}

describe("content/videos (repo の実データ)", () => {
  it("ep001 は 8 章・YouTube 概要欄と同じ時刻・出典の全件を持つ", () => {
    const video = getVideoBySlug(EP001);
    expect(video).not.toBeNull();
    expect(video!.href).toBe(`/videos/${EP001}`);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "06:29",
      "11:07",
      "16:25",
      "21:55",
      "26:45",
      "31:50",
      "36:07",
    ]);
    expect(video!.durationSeconds).toBe(41 * 60 + 25);
    // 概要欄に入りきらない出典の正本。件数は台本の写し (sources.json) と一致する
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "content", "videos", EP001, "sources.json"), "utf8"),
    );
    expect(video!.sources).toHaveLength(raw.sources.length);
    expect(video!.sources.length).toBeGreaterThan(80);
    expect(video!.bodyJa.length).toBeGreaterThan(0);
  });

  it("ep005 は 6 章・YouTube 概要欄と同じ時刻・出典 108 件を持つ", () => {
    const video = getVideoBySlug("ep005-destruction-and-creation");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:57",
      "05:59",
      "10:23",
      "17:05",
      "18:59",
    ]);
    expect(video!.durationSeconds).toBe(25 * 60 + 12);
    expect(video!.sources).toHaveLength(108);
  });

  it("ep006 は 6 章・YouTube 概要欄と同じ時刻・出典 48 件を持つ", () => {
    const video = getVideoBySlug("ep006-ai-installment");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:43",
      "04:07",
      "06:59",
      "09:57",
      "12:10",
    ]);
    expect(video!.durationSeconds).toBe(15 * 60 + 15);
    expect(video!.sources).toHaveLength(48);
  });

  it("ep013 は第 12 回・5 章・YouTube 概要欄と同じ時刻・出典 10 件を持つ", () => {
    const video = getVideoBySlug("ep013-anthropic-ipo-eve");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep013");
    expect(video!.episodeNumber).toBe(12);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual(["00:00", "01:02", "02:42", "04:23", "06:17"]);
    expect(video!.durationSeconds).toBe(7 * 60 + 43);
    expect(video!.sources).toHaveLength(10);
  });

  it("ep013 は YouTube の動画 ID を持つ", () => {
    const video = getVideoBySlug("ep013-anthropic-ipo-eve");
    expect(video).not.toBeNull();
    expect(video!.youtubeVideoId).toBe("DaU8Z4Go2tY");
  });

  it("ep010 は第 14 回・5 章・YouTube 概要欄と同じ時刻・出典 13 件を持ち、最新の投稿になる", () => {
    const video = getVideoBySlug("ep010-anthropic-ipo-first-day");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep010");
    expect(video!.episodeNumber).toBe(14);
    expect(video!.youtubeVideoId).toBe("CyUiWGgeJPQ");
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual(["00:00", "01:15", "03:17", "05:57", "08:48"]);
    expect(video!.durationSeconds).toBe(10 * 60 + 16);
    expect(video!.sources).toHaveLength(13);
  });

  it("ep015 は第 15 回・5 章・YouTube 概要欄と同じ時刻・出典 13 件を持ち、最新の投稿になる", () => {
    const video = getVideoBySlug("ep015-nikkei-3007-nisa");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep015");
    expect(video!.episodeNumber).toBe(15);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual(["00:00", "01:01", "02:30", "04:14", "05:53"]);
    expect(video!.youtubeVideoId).toBe("oZUfZQ5ZTbc");
    expect(video!.durationSeconds).toBe(7 * 60 + 20);
    expect(video!.sources).toHaveLength(13);
  });

  it("ep016 は第 16 回・8 章・YouTube 概要欄と同じ時刻・出典 19 件を持ち、最新の投稿になる", () => {
    const video = getVideoBySlug("ep016-riemann-hypothesis-ai");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep016");
    expect(video!.episodeNumber).toBe(16);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:26",
      "03:17",
      "05:07",
      "06:59",
      "09:23",
      "10:51",
      "13:41",
    ]);
    expect(video!.youtubeVideoId).toBe("jo2Pm1xi8Qg");
    expect(video!.durationSeconds).toBe(16 * 60 + 9);
    expect(video!.sources).toHaveLength(19);
  });

  it("ep018 は第 17 回・8 章・YouTube 概要欄と同じ時刻・出典 32 件を持つ", () => {
    const video = getVideoBySlug("ep018-millennium-prize-ai");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep018");
    expect(video!.episodeNumber).toBe(17);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:51",
      "03:04",
      "04:30",
      "06:57",
      "08:39",
      "10:13",
      "12:30",
    ]);
    expect(video!.youtubeVideoId).toBe("I2ENuQf9KfA");
    expect(video!.durationSeconds).toBe(14 * 60 + 27);
    expect(video!.sources).toHaveLength(32);
  });

  it("ep017 は第 18 回・6 章・YouTube 概要欄と同じ時刻・出典 13 件を持つ", () => {
    const video = getVideoBySlug("ep017-bitcoin-four-year-cycle");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep017");
    expect(video!.episodeNumber).toBe(18);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "02:02",
      "06:14",
      "09:49",
      "12:50",
      "16:13",
    ]);
    expect(video!.youtubeVideoId).toBe("lTgo1ME7Zu0");
    expect(video!.durationSeconds).toBe(18 * 60 + 26);
    expect(video!.sources).toHaveLength(13);
  });

  it("ep019 は第 19 回・6 章・YouTube 概要欄と同じ時刻・出典 8 件を持つ", () => {
    const video = getVideoBySlug("ep019-ustr-301-japan-household-investment");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep019");
    expect(video!.episodeNumber).toBe(19);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "02:02",
      "04:10",
      "07:23",
      "12:26",
      "14:24",
    ]);
    expect(video!.youtubeVideoId).toBe("ZtNnci6N2Ss");
    expect(video!.durationSeconds).toBe(16 * 60 + 39);
    expect(video!.sources).toHaveLength(8);
  });

  it("ep020 は第 20 回・6 章・YouTube 概要欄と同じ時刻・出典 34 件を持ち、最新の投稿になる", () => {
    const video = getVideoBySlug("ep020-spacex-shares-trump-accounts");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep020");
    expect(video!.episodeNumber).toBe(20);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:56",
      "04:41",
      "07:02",
      "09:32",
      "11:31",
    ]);
    expect(video!.youtubeVideoId).toBe("BoxRXn73vdU");
    expect(video!.durationSeconds).toBe(13 * 60 + 37);
    expect(video!.sources).toHaveLength(34);
    expect(getLatestPostedVideo()?.slug).toBe("ep020-spacex-shares-trump-accounts");
  });

  it("ep014 は第 13 回・5 章・YouTube 概要欄と同じ時刻・出典 7 件を持つ", () => {
    const video = getVideoBySlug("ep014-gdp-minus-boj-hike");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep014");
    expect(video!.episodeNumber).toBe(13);
    expect(video!.youtubeVideoId).toBe("vMjQPfRUGi4");
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual(["00:00", "01:07", "02:14", "04:17", "05:40"]);
    expect(video!.durationSeconds).toBe(7 * 60 + 5);
    expect(video!.sources).toHaveLength(7);
  });

  it("ep012 は第 11 回・7 章・YouTube 概要欄と同じ時刻・出典 29 件を持つ", () => {
    const video = getVideoBySlug("ep012-yen-160-rate-gap");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep012");
    expect(video!.episodeNumber).toBe(11);
    expect(video!.youtubeVideoId).toBe("MOrzqveDz90");
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual(["00:00", "01:18", "02:49", "04:01", "05:25", "06:48", "09:19"]);
    expect(video!.durationSeconds).toBe(10 * 60 + 55);
    expect(video!.sources).toHaveLength(29);
  });

  it("ep011 は第 10 回・6 章・YouTube 概要欄と同じ時刻・出典 20 件を持つ", () => {
    const video = getVideoBySlug("ep011-nvidia-ceo-transition");
    expect(video).not.toBeNull();
    expect(video!.episodeId).toBe("ep011");
    expect(video!.episodeNumber).toBe(10);
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:17",
      "02:20",
      "04:59",
      "07:03",
      "09:20",
    ]);
    expect(video!.durationSeconds).toBe(11 * 60 + 3);
    expect(video!.sources).toHaveLength(20);
  });

  it("ep009 は 5 章・YouTube 概要欄と同じ時刻・出典 11 件を持つ", () => {
    const video = getVideoBySlug("ep009-anthropic-ipo-price");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "00:47",
      "02:59",
      "04:49",
      "06:52",
    ]);
    expect(video!.durationSeconds).toBe(8 * 60 + 28);
    expect(video!.sources).toHaveLength(11);
  });

  it("ep008 は 7 章・YouTube 概要欄と同じ時刻・出典 34 件を持つ", () => {
    const video = getVideoBySlug("ep008-fable-5-2");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:32",
      "05:24",
      "07:09",
      "10:22",
      "14:27",
      "17:18",
    ]);
    expect(video!.durationSeconds).toBe(21 * 60 + 12);
    expect(video!.sources).toHaveLength(34);
  });

  it("ep007 は 6 章・YouTube 概要欄と同じ時刻・出典 23 件を持つ", () => {
    const video = getVideoBySlug("ep007-anthropic-ipo-lottery");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:23",
      "03:45",
      "06:28",
      "08:59",
      "10:29",
    ]);
    expect(video!.durationSeconds).toBe(13 * 60 + 41);
    expect(video!.sources).toHaveLength(23);
  });

  it("ep004 は 5 章・YouTube 概要欄と同じ時刻・出典 51 件を持つ", () => {
    const video = getVideoBySlug("ep004-what-to-believe");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "01:44",
      "05:08",
      "07:58",
      "11:42",
    ]);
    expect(video!.durationSeconds).toBe(16 * 60 + 54);
    expect(video!.sources).toHaveLength(51);
  });

  it("ep003 は 6 章・YouTube 概要欄と同じ時刻・出典 11 件を持つ", () => {
    const video = getVideoBySlug("ep003-ai-near-future-timetable");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "03:21",
      "06:09",
      "09:06",
      "13:02",
      "15:54",
    ]);
    expect(video!.durationSeconds).toBe(22 * 60 + 4);
    expect(video!.sources).toHaveLength(11);
  });

  it("ep002 は 6 章・YouTube 概要欄と同じ時刻・出典 51 件を持つ", () => {
    const video = getVideoBySlug("ep002-who-holds-the-key");
    expect(video).not.toBeNull();
    expect(video!.chapters.map((chapter) => chapter.start)).toEqual([
      "00:00",
      "03:12",
      "07:51",
      "12:53",
      "17:59",
      "23:00",
    ]);
    expect(video!.durationSeconds).toBe(28 * 60 + 50);
    expect(video!.sources).toHaveLength(51);
  });

  it("出典は全件がどこかの章に入る (取りこぼしなし)", () => {
    for (const video of getAllVideos()) {
      const grouped = groupSourcesByChapter(video).flatMap((group) => group.sources);
      expect(grouped).toHaveLength(video.sources.length);
    }
  });

  it("アイキャッチは public/ に実在する", () => {
    for (const video of getAllVideos()) {
      if (!video.eyecatch) continue;
      expect(fs.existsSync(path.join(process.cwd(), "public", video.eyecatch.src))).toBe(true);
    }
  });
});

describe("lib/videos の検証", () => {
  it("YouTube の動画 ID は 11 文字だけ通す", () => {
    expect(loadMutated((meta) => (meta.youtubeVideoId = "dQw4w9WgXcQ"))()[0].youtubeVideoId).toBe(
      "dQw4w9WgXcQ",
    );
    expect(() => loadMutated((meta) => (meta.youtubeVideoId = "https://youtu.be/dQw4w9WgXcQ"))()).toThrow();
    expect(() => loadMutated((meta) => (meta.youtubeVideoId = "short"))()).toThrow();
  });

  it("章は 0:00 から時刻順・動画の長さの内側", () => {
    expect(() =>
      loadMutated((meta) => {
        const chapters = meta.chapters as Array<{ start: string }>;
        chapters[1].start = "00:00";
      })(),
    ).toThrow(/time order/);
    expect(() =>
      loadMutated((meta) => {
        (meta.chapters as Array<{ start: string }>)[0].start = "00:05";
      })(),
    ).toThrow(/0:00/);
    expect(() => loadMutated((meta) => (meta.durationSeconds = 60))()).toThrow(/ends/);
  });

  it("関連記事はサイト内の /articles/ だけを通す", () => {
    expect(() =>
      loadMutated((meta) => {
        meta.relatedArticles = [{ titleJa: "外部", href: "https://example.com/x" }];
      })(),
    ).toThrow();
  });

  it("関連記事の family は任意・入れるなら slug の頭の種類と一致", () => {
    const withAndWithout = loadMutated((meta) => {
      meta.relatedArticles = [
        { titleJa: "深掘り", href: "/articles/deep-dive-20261111-e56c533b", family: "deep-dive" },
        { titleJa: "種類なし", href: "/articles/some-article" },
      ];
    })()[0].relatedArticles;
    expect(withAndWithout.map((article) => article.family)).toEqual(["deep-dive", undefined]);
    expect(() =>
      loadMutated((meta) => {
        meta.relatedArticles = [
          { titleJa: "食い違い", href: "/articles/deep-dive-20261111-e56c533b", family: "signal" },
        ];
      })(),
    ).toThrow(/slug prefix/);
    expect(() =>
      loadMutated((meta) => {
        meta.relatedArticles = [{ titleJa: "不明", href: "/articles/signal-1", family: "no-such-family" }];
      })(),
    ).toThrow();
  });

  it("repo の関連記事は slug の頭が種類なら family を持つ", () => {
    for (const video of getAllVideos()) {
      for (const article of video.relatedArticles) {
        const slug = article.href.replace("/articles/", "");
        const prefixed = /^[a-z0-9]+(?:-[a-z0-9]+)*?-\d{8}-/.test(slug);
        if (prefixed) expect(article.family, article.href).toBeDefined();
      }
    }
  });

  it("同じ URL の出典が 2 件あれば落とす", () => {
    expect(() =>
      loadMutated((_meta, sources) => {
        const list = sources.sources as Array<{ url: string }>;
        list[1].url = list[0].url;
      })(),
    ).toThrow(/duplicate source url/);
  });

  it("存在しない章を指す出典を落とす", () => {
    expect(() =>
      loadMutated((_meta, sources) => {
        (sources.sources as Array<{ chapter: number }>)[0].chapter = 99;
      })(),
    ).toThrow(/chapter 99/);
  });

  it("slug はディレクトリ名と一致し、不正な slug は読まない", () => {
    expect(() => loadMutated((meta) => (meta.slug = "other-slug"))()).toThrow(/directory name/);
    expect(getVideoBySlug("../etc")).toBeNull();
    expect(getVideoBySlug("no-such-video")).toBeNull();
  });
});

describe("lib/videos の補助関数", () => {
  it("timestampToSeconds", () => {
    expect(timestampToSeconds("00:00")).toBe(0);
    expect(timestampToSeconds("04:19")).toBe(259);
    expect(timestampToSeconds("1:02:03")).toBe(3723);
    expect(() => timestampToSeconds("4:7")).toThrow();
  });

  it("formatDurationJa", () => {
    expect(formatDurationJa(2303)).toBe("38分23秒");
    expect(formatDurationJa(3723)).toBe("1時間2分3秒");
  });

  it("youtubeWatchUrl は 0 秒なら t を付けない", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(youtubeWatchUrl("dQw4w9WgXcQ", 259)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=259s",
    );
  });
});

describe("動画の窓に出す回 (YouTube に上がった回だけ)", () => {
  it("投稿前の回しか無ければ窓に出すものは無い", () => {
    const contentDir = mutatedDir((meta) => delete meta.youtubeVideoId);
    expect(getLatestPostedVideo({ contentDir })).toBeNull();
    expect(
      getPostedVideoForArticle("/articles/future-map-20261031-2ac42693", { contentDir }),
    ).toBeNull();
  });

  it("投稿後は最新の回と、関連記事に挙げた記事の解説動画を返す", () => {
    const contentDir = mutatedDir((meta) => (meta.youtubeVideoId = "dQw4w9WgXcQ"));
    expect(getLatestPostedVideo({ contentDir })?.href).toBe(`/videos/${EP001}`);
    expect(
      getPostedVideoForArticle("/articles/future-map-20261031-2ac42693", { contentDir })?.slug,
    ).toBe(EP001);
    expect(getPostedVideoForArticle("/articles/unrelated", { contentDir })).toBeNull();
  });
});
