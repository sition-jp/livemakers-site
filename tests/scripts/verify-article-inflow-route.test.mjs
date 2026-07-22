import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyArticleInflowRouteEvidence } from "../../scripts/verify-article-inflow-route.mjs";

const BODY = "# Exact Production body\n\nUTF-8: 検証。\n";
const CHECKSUM = createHash("sha256").update(BODY, "utf8").digest("hex");
const SLUG = "daily-intel-20260719-48cea1b8";

function feed() {
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "production",
    generated_at: "2026-07-22T12:20:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles: [{
      slug: SLUG,
      body: BODY,
      body_checksum: CHECKSUM,
      validator: { verdict: "green" },
    }],
  };
}

function routeHtml({
  declared = CHECKSUM,
  rendered = CHECKSUM,
  source = "inflow",
} = {}) {
  return `<div data-testid="article-inflow-public-body" data-article-source="${source}" data-declared-body-checksum="${declared}" data-rendered-body-checksum="${rendered}">rendered</div>`;
}

describe("article inflow canonical route verifier", () => {
  it("passes only when HTTP, feed declaration, rendered declaration, and exact body hash agree", () => {
    expect(verifyArticleInflowRouteEvidence({
      feed: feed(),
      slug: SLUG,
      routeStatus: 200,
      routeHtml: routeHtml(),
    })).toEqual({
      ok: true,
      errors: [],
      slug: SLUG,
      route_http_status: 200,
      schema_version: "livemakers_article_inflow_feed_v0",
      environment: "production",
      feed_checksum: "8f36d3924040c7aa",
      declared_body_checksum: CHECKSUM,
      page_declared_body_checksum: CHECKSUM,
      rendered_body_checksum: CHECKSUM,
      exact_body_checksum: CHECKSUM,
    });
  });

  it.each([
    ["route_http_status", { routeStatus: 404 }],
    ["feed_schema_version", { mutateFeed: (value) => { value.schema_version = "wrong"; } }],
    ["feed_environment", { mutateFeed: (value) => { value.environment = "staging"; } }],
    ["target_article_count", { mutateFeed: (value) => { value.articles = []; } }],
    ["exact_body_checksum_mismatch", {
      mutateFeed: (value) => { value.articles[0].body_checksum = "0".repeat(64); },
    }],
    ["page_source", { html: routeHtml({ source: "repository" }) }],
    ["page_declared_checksum", { html: routeHtml({ declared: "1".repeat(64) }) }],
    ["page_rendered_checksum", { html: routeHtml({ rendered: "2".repeat(64) }) }],
    ["page_declared_checksum", { html: "<html>missing evidence</html>" }],
  ])("fails closed with %s", (expectedError, change) => {
    const candidate = feed();
    change.mutateFeed?.(candidate);
    const result = verifyArticleInflowRouteEvidence({
      feed: candidate,
      slug: SLUG,
      routeStatus: change.routeStatus ?? 200,
      routeHtml: change.html ?? routeHtml(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(expectedError);
  });
});
