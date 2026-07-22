#!/usr/bin/env node

import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "livemakers_article_inflow_feed_v0";
const CHECKSUM = /^[0-9a-f]{64}$/;

function sha256(body) {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function readSingleAttribute(html, name) {
  const matches = [...html.matchAll(new RegExp(`${name}=["']([^"']*)["']`, "g"))];
  return matches.length === 1 ? matches[0][1] : null;
}

export function verifyArticleInflowRouteEvidence({
  feed,
  slug,
  routeStatus,
  routeHtml,
  feedStatus = 200,
}) {
  const errors = [];
  const schemaVersion = feed && typeof feed === "object" ? feed.schema_version ?? null : null;
  const environment = feed && typeof feed === "object" ? feed.environment ?? null : null;
  const feedChecksum = feed && typeof feed === "object" ? feed.feed_checksum ?? null : null;

  if (feedStatus !== 200) errors.push("feed_http_status");
  if (routeStatus !== 200) errors.push("route_http_status");
  if (schemaVersion !== SCHEMA_VERSION) errors.push("feed_schema_version");
  if (environment !== "production") errors.push("feed_environment");

  const articles = Array.isArray(feed?.articles) ? feed.articles : [];
  const matches = articles.filter((article) => article?.slug === slug);
  if (matches.length !== 1) errors.push("target_article_count");
  const article = matches.length === 1 ? matches[0] : null;
  const body = typeof article?.body === "string" ? article.body : null;
  const declaredBodyChecksum = typeof article?.body_checksum === "string"
    ? article.body_checksum
    : null;
  const exactBodyChecksum = body === null ? null : sha256(body);

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
  const pageDeclaredBodyChecksum = readSingleAttribute(
    html,
    "data-declared-body-checksum",
  );
  const renderedBodyChecksum = readSingleAttribute(
    html,
    "data-rendered-body-checksum",
  );

  if (pageSource !== "inflow") errors.push("page_source");
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
    schema_version: schemaVersion,
    environment,
    feed_checksum: feedChecksum,
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
