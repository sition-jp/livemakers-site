import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  ARTICLE_BLOB_ORIGIN,
  ARTICLE_INFLOW_BODY_SCHEMA_VERSION,
  ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION,
  parseArticleInflowBody,
  parseArticleInflowCatalog,
} from "@/lib/articles/article-inflow-validation.mjs";

const BODY = "# Catalog body\n\nExact bytes.\n";
const CHECKSUM = createHash("sha256").update(BODY, "utf8").digest("hex");
const SLUG = "daily-intel-20260827-48cea1b8";

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
        title: "Daily Intel",
        family: "daily-intel",
        source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
        published_at: "2026-08-27T07:05:00+09:00",
        body_checksum: CHECKSUM,
        body_url: `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/bodies/${SLUG}.${CHECKSUM.slice(0, 16)}.json`,
        validator: { verdict: "green", vocabulary_version: "v1" },
      },
    ],
  };
}

describe("article inflow catalog v1 contract", () => {
  it("accepts a valid body-less catalog", () => {
    const parsed = parseArticleInflowCatalog(validCatalog());
    expect(parsed?.articles).toHaveLength(1);
    expect(parsed?.articles[0].body_url).toContain(ARTICLE_BLOB_ORIGIN);
    expect((parsed?.articles[0] as { body?: string }).body).toBeUndefined();
    expect(parsed?.source_feed_checksum).toBe("aabbccddeeff0011");
  });

  it.each([
    ["unknown version", (value: any) => (value.schema_version = "v99")],
    [
      "foreign body_url origin",
      (value: any) => (value.articles[0].body_url = "https://evil.example/b.json"),
    ],
    ["missing body_url", (value: any) => delete value.articles[0].body_url],
    [
      "carried body payload is not a catalog concern but mirror+provenance is",
      (value: any) => (value.articles[0].provenance = {
        approval_model: "policy",
        lane: "P2-LVM-SITEFIRST-G1",
        doctrine: "livemakers-sitefirst-policy-publish",
      }),
    ],
    ["non-green validator", (value: any) => (value.articles[0].validator.verdict = "red")],
    ["duplicate slug", (value: any) => value.articles.push({ ...value.articles[0] })],
    ["missing source_feed_checksum", (value: any) => delete value.source_feed_checksum],
  ])("rejects the catalog for %s", (_label, mutate) => {
    const payload = validCatalog();
    mutate(payload);
    expect(parseArticleInflowCatalog(payload)).toBeNull();
  });
});

describe("article inflow body v1 contract", () => {
  const expected = { slug: SLUG, bodyChecksum: CHECKSUM };

  function validBody() {
    return {
      schema_version: ARTICLE_INFLOW_BODY_SCHEMA_VERSION,
      slug: SLUG,
      body_checksum: CHECKSUM,
      body: BODY,
    };
  }

  it("returns the body string when the binding matches", () => {
    expect(parseArticleInflowBody(validBody(), expected)).toBe(BODY);
  });

  it("rejects a body blob bound to another slug", () => {
    expect(
      parseArticleInflowBody(validBody(), { ...expected, slug: "other-slug" }),
    ).toBeNull();
  });

  it("rejects when catalog-declared checksum differs", () => {
    expect(
      parseArticleInflowBody(validBody(), {
        ...expected,
        bodyChecksum: "0".repeat(64),
      }),
    ).toBeNull();
  });

  it("rejects when body bytes do not match the declared checksum", () => {
    const payload = validBody();
    payload.body = "# tampered\n";
    expect(parseArticleInflowBody(payload, expected)).toBeNull();
  });

  it("rejects an unsafe body (raw HTML)", () => {
    const unsafe = "safe intro\n\n<script>alert(1)</script>\n";
    const payload = {
      schema_version: ARTICLE_INFLOW_BODY_SCHEMA_VERSION,
      slug: SLUG,
      body_checksum: createHash("sha256").update(unsafe, "utf8").digest("hex"),
      body: unsafe,
    };
    expect(
      parseArticleInflowBody(payload, {
        slug: SLUG,
        bodyChecksum: payload.body_checksum,
      }),
    ).toBeNull();
  });
});
