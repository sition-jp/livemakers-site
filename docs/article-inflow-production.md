# Article inflow Production public routes

## Scope

The public consumer overlays a validated Production feed on repository articles for exactly these surfaces:

- `/ja/articles/<slug>` and `/en/articles/<slug>`
- `/ja/articles/today` and `/en/articles/today`
- `/ja/articles/series/<series>` and `/en/articles/series/<series>`

Home and G44 remain repository-only. Hidden preview keeps its separate staging-capable URL and flag.

## Vercel Production configuration

Use only these dedicated Production variables:

- `LIVEMAKERS_ARTICLE_INFLOW_PRODUCTION_FEED_URL`: canonical Production JSON feed URL
- `LIVEMAKERS_ARTICLE_INFLOW_PUBLIC_ENABLED`: `true` or `1` to permit reads

The public loader performs no request while the flag is disabled or the URL is absent. It accepts only `schema_version=livemakers_article_inflow_feed_v0` with `environment=production`. Network, HTTP, JSON, schema, validator, duplicate-slug, exact-body-checksum, or Markdown-safety failure discards the complete feed and returns the repository-only catalog. A staging feed can never populate a public route. Repository articles win every slug collision.

The server boundary requests the feed with a five-minute Next.js revalidation hint. Detail, Today, and series all use the same catalog; route components never fetch the feed directly.

## Deployment gate

1. Confirm the site commit and Vercel Production deployment correspond to the reviewed PR merge.
2. Confirm a known repository-owned canonical article remains HTTP 200.
3. Confirm the public flag/URL are the dedicated Production values and the hidden-preview values are not reused.
4. Confirm SDE current main includes the PR #89-equivalent stale-edge readback fix. Until its main SHA is supplied, Production activation remains stopped.
5. A missing or empty Production feed is an expected repository-only state. Do not seed the named target into the repository and do not point public routes at staging to manufacture a 200.

## Canonical checksum evidence

The verifier is read-only: it issues cache-busted GET requests and never writes a feed or event. Run it only when the authorized Production sequence has made the named slug available:

```sh
npm run verify:article-inflow-route -- \
  --feed-url "$LIVEMAKERS_ARTICLE_INFLOW_PRODUCTION_FEED_URL" \
  --route-url "https://livemakers.com/ja/articles/daily-intel-20260719-48cea1b8" \
  --slug "daily-intel-20260719-48cea1b8"
```

Exit status is zero only when all of the following hold:

- canonical route HTTP status is 200;
- feed schema is the approved version and `environment=production`;
- exactly one feed article owns the slug and its validator verdict is green;
- SHA-256 of the exact UTF-8 feed `body` equals its `body_checksum`;
- the page declares `data-article-source=inflow`;
- `data-declared-body-checksum` and `data-rendered-body-checksum` both equal the feed declaration and exact-body hash.

Retain the JSON output with the deployment URL/commit and UTC/JST observation time as Acceptance (a) evidence.

## Acceptance Stop

The first Production emission is not authorized by the site deployment. It remains stopped until all three conditions are independently satisfied:

1. Acceptance (a): canonical route HTTP 200 and declared/rendered/exact-body checksums all match.
2. Acceptance (b): 田平氏 approves the first named backlog packet, including cutoff, counts, every slug/title/source X URL/body checksum, aggregate checksum, tombstone exclusions, and quarantine/deferred decisions.
3. Acceptance (c): cap, sentinel, and tombstone exercise hashes are rechecked at execution time.

The site task does not PUT the Production feed, switch SDE stage, create readiness state, write publish events, activate the contract registry, or approve the backlog packet.
