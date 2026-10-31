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
      "04:19",
      "08:58",
      "14:16",
      "19:46",
      "24:36",
      "29:40",
      "33:58",
    ]);
    expect(video!.durationSeconds).toBe(38 * 60 + 23);
    // 概要欄に入りきらない出典の正本。件数は台本の写し (sources.json) と一致する
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "content", "videos", EP001, "sources.json"), "utf8"),
    );
    expect(video!.sources).toHaveLength(raw.sources.length);
    expect(video!.sources.length).toBeGreaterThan(80);
    expect(video!.bodyJa.length).toBeGreaterThan(0);
  });

  it("出典は全件がどこかの章に入る (取りこぼしなし)", () => {
    const video = getVideoBySlug(EP001)!;
    const grouped = groupSourcesByChapter(video).flatMap((group) => group.sources);
    expect(grouped).toHaveLength(video.sources.length);
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
