import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

/**
 * YouTube 動画の受け皿 (/videos 一覧と /videos/<slug> の記事)。
 *
 * 1 本 = content/videos/<slug>/ の 3 ファイル:
 *   video.json   — 題名・長さ・章立て・YouTube の動画 ID (投稿前は無し)
 *   ja.md        — 記事の本文 (要点)
 *   sources.json — 出典の全件。台本 (livemakers-youtube の script.yaml) が正本で、
 *                  scripts/videos/sync-sources.mjs で書き出す
 *
 * YouTube の概要欄は 5,000 字までで出典が入りきらないため、出典の全件はこの
 * 記事に置き、概要欄からはこの記事へリンクする。
 *
 * 投稿後に足すのは video.json の `youtubeVideoId` と `publishedAtJst` の 2 つ。
 * それだけで記事に埋め込みが出て、チャプターが YouTube の該当時刻へのリンクになる。
 */

const TIMESTAMP = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/;

export const VideoChapterSchema = z.strictObject({
  start: z.string().regex(TIMESTAMP),
  title: z.string().min(1),
  summaryJa: z.string().min(1),
});

export const VideoMetaSchema = z
  .strictObject({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    episodeId: z.string().regex(/^ep\d{3}$/),
    episodeNumber: z.number().int().positive(),
    titleJa: z.string().min(1),
    subtitleJa: z.string().min(1).optional(),
    excerptJa: z.string().min(1),
    durationSeconds: z.number().int().positive(),
    /** 動画の中の数字・日付の時点 */
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** YouTube に公開した日時。投稿前は無し */
    publishedAtJst: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/)
      .optional(),
    /** YouTube の動画 ID (11 文字)。投稿前は無し */
    youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
    /** 記事のアイキャッチ (文字なしの生成画像・YouTube のサムネとは別) */
    eyecatch: z
      .strictObject({
        src: z.string().startsWith("/"),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        alt: z.string().min(1),
      })
      .optional(),
    chapters: z.array(VideoChapterSchema).min(1),
    /** この動画と関係のあるサイトの記事 (台本の `related` と同じ並び) */
    relatedArticles: z
      .array(
        z.strictObject({
          titleJa: z.string().min(1),
          href: z.string().regex(/^\/articles\/[a-z0-9-]+$/),
        }),
      )
      .default([]),
  })
  .superRefine((meta, context) => {
    const starts = meta.chapters.map((chapter) => timestampToSeconds(chapter.start));
    if (starts[0] !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "first chapter must start at 0:00" });
    }
    starts.forEach((start, index) => {
      if (index > 0 && start <= starts[index - 1]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "chapters must be in time order" });
      }
      if (start >= meta.durationSeconds) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "chapter starts after the video ends" });
      }
    });
  });

export const VideoSourceSchema = z.strictObject({
  key: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().startsWith("https://"),
  accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** その出典を最初に引いた章 (1 始まり) */
  chapter: z.number().int().positive(),
});

export const VideoSourcesFileSchema = z.strictObject({
  episodeId: z.string().regex(/^ep\d{3}$/),
  sources: z.array(VideoSourceSchema).min(1),
});

export type VideoChapter = z.infer<typeof VideoChapterSchema>;
export type VideoMeta = z.infer<typeof VideoMetaSchema>;
export type VideoSource = z.infer<typeof VideoSourceSchema>;

export interface Video extends VideoMeta {
  href: string;
  sources: VideoSource[];
  bodyJa: string;
}

export interface VideoLoadOptions {
  contentDir?: string;
}

const DEFAULT_CONTENT_DIR = path.join(process.cwd(), "content", "videos");

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadVideo(contentDir: string, directory: string): Video {
  const dir = path.join(contentDir, directory);
  const meta = VideoMetaSchema.parse(readJson(path.join(dir, "video.json")));
  if (meta.slug !== directory) {
    throw new Error(`slug must equal directory name: ${directory}`);
  }
  const sourcesFile = VideoSourcesFileSchema.parse(readJson(path.join(dir, "sources.json")));
  if (sourcesFile.episodeId !== meta.episodeId) {
    throw new Error(`sources.json belongs to ${sourcesFile.episodeId}, not ${meta.episodeId}`);
  }
  const keys = new Set<string>();
  const urls = new Set<string>();
  for (const source of sourcesFile.sources) {
    if (source.chapter > meta.chapters.length) {
      throw new Error(`source ${source.key} cites chapter ${source.chapter} of ${meta.chapters.length}`);
    }
    if (keys.has(source.key)) throw new Error(`duplicate source key: ${source.key}`);
    if (urls.has(source.url)) throw new Error(`duplicate source url: ${source.url}`);
    keys.add(source.key);
    urls.add(source.url);
  }
  return {
    ...meta,
    href: `/videos/${meta.slug}`,
    sources: sourcesFile.sources,
    bodyJa: fs.readFileSync(path.join(dir, "ja.md"), "utf8"),
  };
}

/** 全動画。新しい回が先。 */
export function getAllVideos(options: VideoLoadOptions = {}): Video[] {
  const contentDir = options.contentDir ?? DEFAULT_CONTENT_DIR;
  if (!fs.existsSync(contentDir)) return [];
  return fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(contentDir, entry.name, "video.json")))
    .map((entry) => loadVideo(contentDir, entry.name))
    .sort((left, right) => right.episodeNumber - left.episodeNumber);
}

export function getVideoBySlug(slug: string, options: VideoLoadOptions = {}): Video | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return getAllVideos(options).find((video) => video.slug === slug) ?? null;
}

/** "38:23" / "1:02:03" → 秒 */
export function timestampToSeconds(timestamp: string): number {
  const match = TIMESTAMP.exec(timestamp);
  if (!match) throw new Error(`bad timestamp: ${timestamp}`);
  const [, hours, minutes, seconds] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** 2303 → "38分23秒" */
export function formatDurationJa(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours > 0 ? `${hours}時間` : ""}${minutes}分${seconds}秒`;
}

/** YouTube の再生ページ。startSeconds を渡すとその時刻から再生する。 */
export function youtubeWatchUrl(videoId: string, startSeconds = 0): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return startSeconds > 0 ? `${base}&t=${startSeconds}s` : base;
}

/** 出典を章ごとにまとめる (章の順・章の中は台本の順) */
export function groupSourcesByChapter(
  video: Pick<Video, "chapters" | "sources">,
): Array<{ chapter: VideoChapter; number: number; sources: VideoSource[] }> {
  return video.chapters
    .map((chapter, index) => ({
      chapter,
      number: index + 1,
      sources: video.sources.filter((source) => source.chapter === index + 1),
    }))
    .filter((group) => group.sources.length > 0);
}

/** 右レーン・右列の動画の窓に渡す最小の形 (publishedAtJst はトップ右列の新着順に使う) */
export type VideoCardData = Pick<
  Video,
  "slug" | "href" | "titleJa" | "subtitleJa" | "durationSeconds" | "eyecatch" | "publishedAtJst"
>;

function toCard(video: Video): VideoCardData {
  const { slug, href, titleJa, subtitleJa, durationSeconds, eyecatch, publishedAtJst } = video;
  return { slug, href, titleJa, subtitleJa, durationSeconds, eyecatch, publishedAtJst };
}

/**
 * 動画の窓は YouTube に上がった回 (youtubeVideoId あり) だけを出す
 * (2026-10-31 田平氏 GO)。投稿前の「近日公開」で目立つ枠を使わない。
 */
function postedVideos(options: VideoLoadOptions): Video[] {
  return getAllVideos(options).filter((video) => video.youtubeVideoId);
}

/**
 * 「最新の記事」のリストに混ぜる動画 (2026-10-31 田平氏 GO): YouTube に上がり、
 * 公開日時がある回。並びは混ぜる側 (mergeLatestEntries) が公開日時で決める。
 */
export function getPostedVideoCards(options: VideoLoadOptions = {}): VideoCardData[] {
  return postedVideos(options)
    .filter((video) => video.publishedAtJst)
    .map(toCard);
}

/** トップ右列・記事の右レーン下の「最新の動画」 */
export function getLatestPostedVideo(options: VideoLoadOptions = {}): VideoCardData | null {
  const latest = postedVideos(options)[0];
  return latest ? toCard(latest) : null;
}

/**
 * 記事の右レーン上の「この記事の解説動画」: その記事を relatedArticles に
 * 挙げている回 (新しい回が先)。articleHref は "/articles/<id>"。
 */
export function getPostedVideoForArticle(
  articleHref: string,
  options: VideoLoadOptions = {},
): VideoCardData | null {
  const video = postedVideos(options).find((candidate) =>
    candidate.relatedArticles.some((article) => article.href === articleHref),
  );
  return video ? toCard(video) : null;
}
