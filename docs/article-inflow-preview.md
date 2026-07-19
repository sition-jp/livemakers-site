# Article inflow hidden preview

The preview flag alone controls route availability. Configure it at runtime:

- `LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED=true`

The feed URL is optional for route availability:

- `LIVEMAKERS_ARTICLE_INFLOW_FEED_URL=<versioned JSON feed URL>`

Without the feed URL, the enabled preview remains repository-only.

The only network reader is `lib/articles/article-inflow-feed.ts`. Any fetch, JSON, schema, validator, duplicate-slug, or body-checksum failure returns the repository-only catalog. Repository slugs win over matching feed slugs.

The preview namespace is `/ja/article-inflow-preview` (or `/en/article-inflow-preview`), has no public navigation entry, and is marked `noindex, nofollow`. Production `/articles`, home, and G44 surfaces do not consume this catalog.

For T7b acceptance, open the feed-only detail route and compare `data-declared-body-checksum` with `data-rendered-body-checksum` on `[data-testid="article-inflow-preview-body"]`. The values must be identical to the feed article's `body_checksum`.
