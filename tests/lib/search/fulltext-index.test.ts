import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ARTICLE_BLOB_ORIGIN } from "@/lib/articles/article-inflow-validation.mjs";
import {
  loadFullTextIndex,
  resetFullTextIndexMemo,
} from "@/lib/search/fulltext-index";

const SHARD_URL = `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/search/2026-10.aaaaaaaaaaaaaaaa.json`;
const shardBytes = Buffer.from(
  JSON.stringify({
    schema_version: "livemakers_article_search_shard_v1",
    month: "2026-10",
    text_rules_version: 1,
    articles: [
      { slug: "i1", text: "本文にだけある Ｘｙｚ 固有名", truncated: false },
      // catalog から取り下げ済み — shard に残っていても返さない
      { slug: "tomb", text: "取り下げ記事", truncated: false },
    ],
  }),
);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function catalog({
  checksum = sha(shardBytes),
  withIndex = true,
  inflowBody,
}: { checksum?: string; withIndex?: boolean; inflowBody?: string } = {}) {
  return {
    articles: [
      { articleId: "r1", titleJa: "R", source: "repository" },
      { articleId: "i1", titleJa: "I", source: "inflow", inflowBody },
    ],
    feedChecksum: null,
    feedPresent: true,
    searchIndex: withIndex
      ? {
          schema_version: "livemakers_article_search_index_v1",
          text_rules_version: 1,
          shards: [{ month: "2026-10", url: SHARD_URL, checksum, article_count: 2 }],
        }
      : null,
  } as never;
}

const readRepositoryBody = (slug: string) =>
  slug === "r1" ? "R\n■ 本文アール https://example.com" : "";

function fetcherFor(bytes: Buffer) {
  return vi.fn(async () => new Response(new Uint8Array(bytes)));
}

beforeEach(() => {
  resetFullTextIndexMemo();
});

describe("loadFullTextIndex", () => {
  it("reads repository bodies and verified shards, limited to catalog slugs", async () => {
    const fetcher = fetcherFor(shardBytes);
    const index = await loadFullTextIndex(catalog(), { fetcher, readRepositoryBody });
    expect(index.complete).toBe(true);
    expect(index.texts.get("r1")).toEqual({ raw: "本文アール", norm: "本文アール" });
    expect(index.texts.get("i1")).toEqual({
      raw: "本文にだけある Ｘｙｚ 固有名",
      norm: "本文にだけある xyz 固有名",
    });
    expect(index.texts.has("tomb")).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(
      SHARD_URL,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("drops a shard whose bytes do not match the checksum", async () => {
    const index = await loadFullTextIndex(catalog({ checksum: "0".repeat(64) }), {
      fetcher: fetcherFor(shardBytes),
      readRepositoryBody,
    });
    expect(index.complete).toBe(false);
    expect(index.texts.has("i1")).toBe(false);
    expect(index.texts.has("r1")).toBe(true);
  });

  it("memoizes shards by URL", async () => {
    const fetcher = fetcherFor(shardBytes);
    await loadFullTextIndex(catalog(), { fetcher, readRepositoryBody });
    await loadFullTextIndex(catalog(), { fetcher, readRepositoryBody });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("is incomplete without a search index unless inflow bodies are inline (v0 fallback)", async () => {
    const fetcher = fetcherFor(shardBytes);
    const missing = await loadFullTextIndex(catalog({ withIndex: false }), {
      fetcher,
      readRepositoryBody,
    });
    expect(missing.complete).toBe(false);
    expect([...missing.texts.keys()]).toEqual(["r1"]);

    const inline = await loadFullTextIndex(
      catalog({ withIndex: false, inflowBody: "I\n本文インライン" }),
      { fetcher, readRepositoryBody },
    );
    expect(inline.complete).toBe(true);
    expect(inline.texts.get("i1")?.raw).toBe("本文インライン");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
