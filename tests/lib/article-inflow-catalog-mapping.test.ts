import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildArticleInflowPublicCatalog } from "@/lib/articles/article-inflow-contract";
import {
  ARTICLE_BLOB_ORIGIN,
  ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION,
  parseArticleInflowCatalog,
} from "@/lib/articles/article-inflow-validation.mjs";

const BODY = "# Catalog body\n\nExact bytes.\n";
const CHECKSUM = createHash("sha256").update(BODY, "utf8").digest("hex");
const SLUG = "signal-20260827-abcd1234";
const BODY_URL = `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/bodies/${SLUG}.${CHECKSUM.slice(0, 16)}.json`;

function validCatalog() {
  return {
    schema_version: ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION,
    environment: "production",
    generated_at: "2026-08-27T18:00:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    source_feed_checksum: "aabbccddeeff0011",
    articles: [
      {
        slug: SLUG,
        title: "Signal",
        family: "signal",
        source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
        published_at: "2026-08-27T07:05:00+09:00",
        body_checksum: CHECKSUM,
        body_url: BODY_URL,
        validator: { verdict: "green", vocabulary_version: "v1" },
      },
    ],
  };
}

describe("catalog v1 → preview article mapping", () => {
  it("carries bodyUrl and declaredBodyChecksum without inflowBody", () => {
    const catalog = parseArticleInflowCatalog(validCatalog());
    expect(catalog).not.toBeNull();
    const built = buildArticleInflowPublicCatalog([], catalog);
    expect(built.feedPresent).toBe(true);
    expect(built.articles).toHaveLength(1);
    const [article] = built.articles;
    expect(article.source).toBe("inflow");
    expect(article.bodyUrl).toBe(BODY_URL);
    expect(article.inflowBody).toBeUndefined();
    expect(article.declaredBodyChecksum).toBe(CHECKSUM);
    expect(built.feedChecksum).toBe("8f36d3924040c7aa");
  });
});
