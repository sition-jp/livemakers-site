import "server-only";

import { createHash } from "node:crypto";

import type { ArticleInflowPublicCatalog } from "@/lib/articles/article-inflow-contract";
import {
  parseArticleSearchShard,
  type ArticleSearchIndexRef,
} from "@/lib/articles/article-inflow-validation.mjs";
import { getArticleBody } from "@/lib/articles/article-model";
import { articleSearchText } from "@/lib/search/article-text";
import { normalizeForSearch } from "@/lib/search/normalize";

/** raw = 表示 (抜き出し) 用の素のテキスト / norm = 一致判定用 (normalizeForSearch 済) */
export type FullTextEntry = { raw: string; norm: string };
export type FullTextIndex = {
  /** catalog に載っている slug だけ */
  texts: Map<string, FullTextEntry>;
  /** 本文を持つべき記事の本文がすべて揃ったか (false = 一部の shard を読めなかった等) */
  complete: boolean;
};

export const FULLTEXT_SEARCH_FLAG_ENV_KEY = "LIVEMAKERS_SEARCH_FULLTEXT_ENABLED";

/** 本文検索の段階有効化 (SDE が shard を出し始めてから Vercel env で on) */
export function isFullTextSearchEnabled(): boolean {
  const value = process.env[FULLTEXT_SEARCH_FLAG_ENV_KEY];
  return value === "1" || value === "true";
}

export const FULLTEXT_SHARD_FETCH_TIMEOUT_MS = 8_000;
const FULLTEXT_SHARD_FETCH_ATTEMPTS = 2;

type ShardRef = ArticleSearchIndexRef["shards"][number];
type ShardTexts = Map<string, FullTextEntry>;

/**
 * shard の URL は中身の sha256 を含む (content-addressed) ので、同じ URL の
 * 中身は変わらない = URL 単位でインスタンス内に保持してよい。月 2.5MB 前後と
 * Next.js data cache の 1 件 2MB 上限を超えうるため fetch cache は使わない
 * (v0 feed fallback のメモと同じ理由)。現在の index に無い URL は捨てる。
 */
const shardMemo = new Map<string, ShardTexts>();
const shardInFlight = new Map<string, Promise<ShardTexts | null>>();
/** repo 記事はデプロイ内で不変 */
const repositoryMemo = new Map<string, FullTextEntry>();

/** テスト用 */
export function resetFullTextIndexMemo(): void {
  shardMemo.clear();
  shardInFlight.clear();
  repositoryMemo.clear();
}

function toEntry(text: string): FullTextEntry {
  return { raw: text, norm: normalizeForSearch(text) };
}

async function fetchShard(
  ref: ShardRef,
  fetcher: typeof fetch,
): Promise<ShardTexts | null> {
  for (let attempt = 1; attempt <= FULLTEXT_SHARD_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher(ref.url, {
        cache: "no-store",
        signal: AbortSignal.timeout(FULLTEXT_SHARD_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      // 中身の照合・schema 拒否は retry しても変わらない
      if (createHash("sha256").update(bytes).digest("hex") !== ref.checksum) {
        console.warn(`[search] shard checksum mismatch: ${ref.month}`);
        return null;
      }
      const shard = parseArticleSearchShard(JSON.parse(bytes.toString("utf8")));
      if (!shard) {
        console.warn(`[search] shard rejected: ${ref.month}`);
        return null;
      }
      return new Map(shard.articles.map((row) => [row.slug, toEntry(row.text)]));
    } catch {
      // fetch レベルの失敗のみ retry
    }
  }
  console.warn(`[search] shard fetch failed: ${ref.month}`);
  return null;
}

function loadShard(ref: ShardRef, fetcher: typeof fetch): Promise<ShardTexts | null> {
  const cached = shardMemo.get(ref.url);
  if (cached) return Promise.resolve(cached);
  const inFlight = shardInFlight.get(ref.url);
  if (inFlight) return inFlight;
  const load = fetchShard(ref, fetcher)
    .then((texts) => {
      if (texts) shardMemo.set(ref.url, texts);
      return texts;
    })
    .finally(() => {
      shardInFlight.delete(ref.url);
    });
  shardInFlight.set(ref.url, load);
  return load;
}

/**
 * サイト内検索 第2段階 (2026-10-02 spec) の本文索引。
 * - repo 記事: 自分のファイル (content/articles/<slug>/ja.md) から規則 v1 でテキスト化
 * - v0 fallback で本文を運んでいる inflow 記事: その本文から
 * - それ以外の inflow 記事: catalog の search_index が指す月別 shard から
 * 返すのは catalog に載っている slug だけ (取り下げ記事は shard に残っても出さない)。
 */
export async function loadFullTextIndex(
  catalog: ArticleInflowPublicCatalog,
  deps: {
    fetcher?: typeof fetch;
    readRepositoryBody?: (slug: string) => string;
  } = {},
): Promise<FullTextIndex> {
  const fetcher = deps.fetcher ?? fetch;
  const readRepositoryBody =
    deps.readRepositoryBody ?? ((slug: string) => getArticleBody(slug, "ja"));

  const refs = catalog.searchIndex?.shards ?? [];
  const liveUrls = new Set(refs.map((ref) => ref.url));
  for (const url of shardMemo.keys()) {
    if (!liveUrls.has(url)) shardMemo.delete(url);
  }
  const shards = await Promise.all(refs.map((ref) => loadShard(ref, fetcher)));
  const shardTexts: ShardTexts = new Map();
  for (const texts of shards) {
    for (const [slug, entry] of texts ?? []) shardTexts.set(slug, entry);
  }

  const texts = new Map<string, FullTextEntry>();
  let needsShard = false;
  for (const article of catalog.articles) {
    const slug = article.articleId;
    if (article.source === "repository") {
      let entry = repositoryMemo.get(slug);
      if (!entry) {
        try {
          entry = toEntry(articleSearchText(readRepositoryBody(slug), article.titleJa).text);
        } catch {
          continue;
        }
        repositoryMemo.set(slug, entry);
      }
      texts.set(slug, entry);
    } else if (article.inflowBody !== undefined) {
      texts.set(slug, toEntry(articleSearchText(article.inflowBody, article.titleJa).text));
    } else {
      needsShard = true;
      const entry = shardTexts.get(slug);
      if (entry) texts.set(slug, entry);
    }
  }

  const shardsOk = shards.every(Boolean);
  return {
    texts,
    complete: shardsOk && (!needsShard || catalog.searchIndex != null),
  };
}
