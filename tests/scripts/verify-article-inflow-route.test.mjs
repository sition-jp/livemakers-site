import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyArticleInflowRouteEvidence } from "../../scripts/verify-article-inflow-route.mjs";

const BODY = "# Exact Production body\n\nUTF-8: 検証。\n";
const CHECKSUM = createHash("sha256").update(BODY, "utf8").digest("hex");
const SLUG = "daily-intel-20260719-48cea1b8";
const ROUTE_URL = `https://livemakers.com/ja/articles/${SLUG}`;

function feed() {
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "production",
    generated_at: "2026-07-22T12:20:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles: [{
      slug: SLUG,
      title: "Production Daily Intel",
      family: "daily-intel",
      source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
      published_at: "2026-07-22T03:20:00+00:00",
      body: BODY,
      body_checksum: CHECKSUM,
      validator: { verdict: "green", vocabulary_version: "99f41b7549a0a4f5" },
    }],
  };
}

function routeHtml({
  declared = CHECKSUM,
  rendered = CHECKSUM,
  source = "inflow",
  pageSlug = SLUG,
} = {}) {
  return `<div data-testid="article-inflow-public-body" data-article-source="${source}" data-article-slug="${pageSlug}" data-declared-body-checksum="${declared}" data-rendered-body-checksum="${rendered}">rendered</div>`;
}

describe("article inflow canonical route verifier", () => {
  it("passes only when HTTP, feed declaration, rendered declaration, and exact body hash agree", () => {
    expect(verifyArticleInflowRouteEvidence({
      feed: feed(),
      slug: SLUG,
      routeStatus: 200,
      routeUrl: ROUTE_URL,
      finalRouteUrl: `${ROUTE_URL}?__lvm_inflow_verify=123`,
      routeRedirected: false,
      routeHtml: routeHtml(),
    })).toEqual({
      ok: true,
      errors: [],
      slug: SLUG,
      route_http_status: 200,
      requested_route_url: ROUTE_URL,
      final_route_url: `${ROUTE_URL}?__lvm_inflow_verify=123`,
      route_redirected: false,
      schema_version: "livemakers_article_inflow_feed_v0",
      environment: "production",
      feed_checksum: "8f36d3924040c7aa",
      page_article_slug: SLUG,
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
    ["feed_contract", { mutateFeed: (value) => { delete value.articles[0].title; } }],
    ["feed_contract", {
      mutateFeed: (value) => { value.articles.push({ ...value.articles[0] }); },
    }],
    ["feed_contract", {
      mutateFeed: (value) => {
        value.articles.push({
          ...value.articles[0],
          slug: "other-production-article",
          body_checksum: "0".repeat(64),
        });
      },
    }],
    ["feed_contract", {
      mutateFeed: (value) => {
        const body = "<script>globalThis.process.exit(1)</script>";
        value.articles.push({
          ...value.articles[0],
          slug: "unsafe-production-article",
          body,
          body_checksum: createHash("sha256").update(body, "utf8").digest("hex"),
        });
      },
    }],
    ["target_article_count", { mutateFeed: (value) => { value.articles = []; } }],
    ["exact_body_checksum_mismatch", {
      mutateFeed: (value) => { value.articles[0].body_checksum = "0".repeat(64); },
    }],
    ["page_source", { html: routeHtml({ source: "repository" }) }],
    ["canonical_route_url", { routeUrl: `https://livemakers.com/ja/articles/not-${SLUG}` }],
    ["final_route_url", { finalRouteUrl: `https://livemakers.com/ja/articles/not-${SLUG}` }],
    ["route_redirect", { routeRedirected: true }],
    ["page_article_slug", { html: routeHtml({ pageSlug: `not-${SLUG}` }) }],
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
      routeUrl: change.routeUrl ?? ROUTE_URL,
      finalRouteUrl: change.finalRouteUrl ?? `${ROUTE_URL}?__lvm_inflow_verify=123`,
      routeRedirected: change.routeRedirected ?? false,
      routeHtml: change.html ?? routeHtml(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(expectedError);
  });
});
