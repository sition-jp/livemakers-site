import { describe, expect, it } from "vitest";
import { buildArticleInflowPublicCatalog } from "@/lib/articles/article-inflow-contract";
import {
  ARTICLE_BLOB_ORIGIN,
  parseArticleSearchIndexRef,
  parseArticleSearchShard,
} from "@/lib/articles/article-inflow-validation.mjs";

const CHECKSUM = "a".repeat(64);
const INDEX = {
  schema_version: "livemakers_article_search_index_v1",
  text_rules_version: 1,
  shards: [
    {
      month: "2026-10",
      url: `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/search/2026-10.${"a".repeat(16)}.json`,
      checksum: CHECKSUM,
      article_count: 1,
    },
  ],
};

describe("parseArticleSearchIndexRef", () => {
  it("accepts the producer shape", () => {
    expect(parseArticleSearchIndexRef(INDEX)).toEqual(INDEX);
  });
  it("rejects foreign origins, bad checksums and missing values", () => {
    const shard = INDEX.shards[0];
    expect(
      parseArticleSearchIndexRef({ ...INDEX, shards: [{ ...shard, url: "https://evil.example/x.json" }] }),
    ).toBeNull();
    expect(
      parseArticleSearchIndexRef({ ...INDEX, shards: [{ ...shard, checksum: "abc" }] }),
    ).toBeNull();
    expect(parseArticleSearchIndexRef(undefined)).toBeNull();
    expect(parseArticleSearchIndexRef({ ...INDEX, text_rules_version: 2 })).toBeNull();
  });
});

describe("parseArticleSearchShard", () => {
  it("accepts slug/text/truncated rows and rejects other shapes", () => {
    const shard = {
      schema_version: "livemakers_article_search_shard_v1",
      month: "2026-10",
      text_rules_version: 1,
      articles: [{ slug: "a", text: "本文", truncated: false }],
    };
    expect(parseArticleSearchShard(shard)).toEqual(shard);
    expect(parseArticleSearchShard({ ...shard, articles: [{ slug: "a" }] })).toBeNull();
  });
});

describe("buildArticleInflowPublicCatalog search index", () => {
  const item = {
    slug: "signal-20261002-abcd1234",
    title: "T",
    family: "signal",
    source_x_url: "https://x.com/LiveMakersCom/status/1",
    published_at: "2026-10-02T08:00:00+09:00",
    body_checksum: "b".repeat(64),
    body_url: `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/bodies/x.json`,
    validator: { verdict: "green", vocabulary_version: "v1" },
  };
  const catalog = {
    schema_version: "livemakers_article_inflow_catalog_v1",
    environment: "production",
    generated_at: "2026-10-02T09:00:00+09:00",
    feed_checksum: "c".repeat(16),
    source_feed_checksum: "d".repeat(16),
    articles: [item],
  };

  it("carries a valid search_index as searchIndex", () => {
    const built = buildArticleInflowPublicCatalog([], { ...catalog, search_index: INDEX } as never);
    expect(built.searchIndex).toEqual(INDEX);
    expect(built.articles).toHaveLength(1);
  });

  it("drops a broken search_index but keeps the articles", () => {
    const built = buildArticleInflowPublicCatalog([], { ...catalog, search_index: { nope: 1 } } as never);
    expect(built.searchIndex).toBeNull();
    expect(built.articles).toHaveLength(1);
  });

  it("has no index without a feed", () => {
    expect(buildArticleInflowPublicCatalog([], null).searchIndex).toBeNull();
  });
});
