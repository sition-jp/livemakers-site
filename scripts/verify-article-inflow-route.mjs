#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import {
  ARTICLE_INFLOW_SCHEMA_VERSION,
  calculateArticleBodyChecksum,
  parseArticleInflowFeed,
} from "../lib/articles/article-inflow-validation.mjs";

const CHECKSUM = /^[0-9a-f]{64}$/;

function readSingleAttribute(html, name) {
  const matches = [...html.matchAll(new RegExp(`${name}=["']([^"']*)["']`, "g"))];
  return matches.length === 1 ? matches[0][1] : null;
}

function routeIdentity(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function isCanonicalRouteUrl(value, slug) {
  try {
    const url = new URL(value);
    return url.origin === "https://livemakers.com"
      && (url.pathname === `/ja/articles/${slug}` || url.pathname === `/en/articles/${slug}`)
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

export function verifyArticleInflowRouteEvidence({
  feed,
  slug,
  routeStatus,
  routeUrl,
  finalRouteUrl,
  routeRedirected,
  routeHtml,
  feedStatus = 200,
}) {
  const errors = [];
  const schemaVersion = feed && typeof feed === "object" ? feed.schema_version ?? null : null;
  const environment = feed && typeof feed === "object" ? feed.environment ?? null : null;
  const feedChecksum = feed && typeof feed === "object" ? feed.feed_checksum ?? null : null;

  if (feedStatus !== 200) errors.push("feed_http_status");
  if (routeStatus !== 200) errors.push("route_http_status");
  if (!isCanonicalRouteUrl(routeUrl, slug)) errors.push("canonical_route_url");
  if (
    routeIdentity(finalRouteUrl) === null
    || routeIdentity(finalRouteUrl) !== routeIdentity(routeUrl)
  ) {
    errors.push("final_route_url");
  }
  if (routeRedirected !== false) errors.push("route_redirect");
  if (schemaVersion !== ARTICLE_INFLOW_SCHEMA_VERSION) errors.push("feed_schema_version");
  if (environment !== "production") errors.push("feed_environment");

  const validatedFeed = parseArticleInflowFeed(feed);
  if (!validatedFeed) errors.push("feed_contract");
  const articles = Array.isArray(feed?.articles) ? feed.articles : [];
  const matches = articles.filter((article) => article?.slug === slug);
  if (matches.length !== 1) errors.push("target_article_count");
  const article = matches.length === 1 ? matches[0] : null;
  const body = typeof article?.body === "string" ? article.body : null;
  const declaredBodyChecksum = typeof article?.body_checksum === "string"
    ? article.body_checksum
    : null;
  const exactBodyChecksum = body === null ? null : calculateArticleBodyChecksum(body);

  if (!CHECKSUM.test(declaredBodyChecksum ?? "")) {
    errors.push("feed_declared_checksum_format");
  }
  if (article && article.validator?.verdict !== "green") {
    errors.push("feed_validator_verdict");
  }
  if (exactBodyChecksum !== declaredBodyChecksum) {
    errors.push("exact_body_checksum_mismatch");
  }

  const html = typeof routeHtml === "string" ? routeHtml : "";
  const pageSource = readSingleAttribute(html, "data-article-source");
  const pageArticleSlug = readSingleAttribute(html, "data-article-slug");
  const pageDeclaredBodyChecksum = readSingleAttribute(
    html,
    "data-declared-body-checksum",
  );
  const renderedBodyChecksum = readSingleAttribute(
    html,
    "data-rendered-body-checksum",
  );

  if (pageSource !== "inflow") errors.push("page_source");
  if (pageArticleSlug !== slug) errors.push("page_article_slug");
  if (
    !CHECKSUM.test(pageDeclaredBodyChecksum ?? "")
    || pageDeclaredBodyChecksum !== declaredBodyChecksum
    || pageDeclaredBodyChecksum !== exactBodyChecksum
  ) {
    errors.push("page_declared_checksum");
  }
  if (
    !CHECKSUM.test(renderedBodyChecksum ?? "")
    || renderedBodyChecksum !== declaredBodyChecksum
    || renderedBodyChecksum !== exactBodyChecksum
  ) {
    errors.push("page_rendered_checksum");
  }

  return {
    ok: errors.length === 0,
    errors,
    slug,
    route_http_status: routeStatus,
    requested_route_url: routeUrl,
    final_route_url: finalRouteUrl,
    route_redirected: routeRedirected,
    schema_version: schemaVersion,
    environment,
    feed_checksum: feedChecksum,
    page_article_slug: pageArticleSlug,
    declared_body_checksum: declaredBodyChecksum,
    page_declared_body_checksum: pageDeclaredBodyChecksum,
    rendered_body_checksum: renderedBodyChecksum,
    exact_body_checksum: exactBodyChecksum,
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function cacheBusted(value, nonce) {
  const url = new URL(value);
  url.searchParams.set("__lvm_inflow_verify", nonce);
  return url.toString();
}

async function main() {
  const feedUrl = argumentValue("--feed-url")
    ?? process.env.LIVEMAKERS_ARTICLE_INFLOW_PRODUCTION_FEED_URL;
  const routeUrl = argumentValue("--route-url");
  const slug = argumentValue("--slug");
  if (!feedUrl || !routeUrl || !slug) {
    throw new Error(
      "usage: verify-article-inflow-route --feed-url <url> --route-url <url> --slug <slug>",
    );
  }

  const nonce = `${Date.now()}`;
  const [feedResponse, routeResponse] = await Promise.all([
    fetch(cacheBusted(feedUrl, nonce), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
    fetch(cacheBusted(routeUrl, nonce), {
      headers: { Accept: "text/html" },
      cache: "no-store",
      redirect: "manual",
    }),
  ]);
  let feed = null;
  try {
    feed = await feedResponse.json();
  } catch {
    // The verifier result below records the resulting contract failures.
  }
  const result = verifyArticleInflowRouteEvidence({
    feed,
    slug,
    feedStatus: feedResponse.status,
    routeStatus: routeResponse.status,
    routeUrl,
    finalRouteUrl: routeResponse.url,
    routeRedirected: routeResponse.redirected,
    routeHtml: await routeResponse.text(),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
