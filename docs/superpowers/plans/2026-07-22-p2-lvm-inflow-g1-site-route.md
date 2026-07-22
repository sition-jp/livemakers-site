# P2-LVM-INFLOW-G1 Site Route Implementation Plan

> **Execution gate:** SITE-ROUTE GO received 2026-07-22. This plan authorizes only the LiveMakers site-side gate. It does not authorize the first Production feed emission.

**Goal:** Make LiveMakers public article detail, Today, and series routes safely consume the Production article-inflow feed while preserving repository content priority and fail-closed behavior.

**Architecture:** Extend the existing hidden-preview schema and body-safety boundary with a separate, Production-only public configuration. Build one server-only catalog that overlays validated inflow articles on repository articles, deduplicates by slug with repository priority, and is consumed uniformly by detail/Today/series. Home and the G44 surface remain repository-only. A standalone verifier compares the feed-declared checksum, checksum rendered into the canonical page, and SHA-256 of the exact feed body.

**Stack:** Next.js App Router, TypeScript, Zod, MDXRemote, Vitest, Node.js SHA-256.

## Hard stops and scope

- Do not modify the SDE repository, LifeMakers:LMK, G44/home, or shared emission state.
- Do not PUT a Production feed, enable SDE stage 3, create `production_readiness.json`, write `site_publish_events.jsonl`, or activate the contract registry.
- Do not consume the staging feed from public routes.
- Public configuration uses dedicated keys and never reuses the hidden-preview URL/flag.
- Production activation remains blocked until the SDE owner supplies a current-main SHA containing PR #89-equivalent stale-edge protection.
- The named target cannot return 200 before it exists in the Production feed without an unauthorized staging or repository-seed bypass. Deploy the consumer safely, then preserve Acceptance Stop until the canonical evidence can be measured under the authorized sequence.

## Task 1: Generalize the catalog contract

**Files:**
- Modify: `lib/articles/article-inflow-contract.ts`
- Test: `tests/lib/article-inflow-contract.test.ts`

1. Add a failing test for a public catalog with `/articles/<slug>` hrefs, repository-first slug deduplication, and stable newest-first ordering.
2. Run `npm test -- tests/lib/article-inflow-contract.test.ts` and confirm the test fails because the public builder is absent.
3. Extract a shared catalog builder, retain the hidden-preview wrapper unchanged, and add a public wrapper.
4. Re-run the targeted test and confirm green.

## Task 2: Add the Production-only server boundary

**Files:**
- Modify: `lib/articles/article-inflow-feed.ts`
- Test: `tests/lib/article-inflow-feed.test.ts`

1. Add failing tests for dedicated keys `LIVEMAKERS_ARTICLE_INFLOW_PUBLIC_ENABLED` and `LIVEMAKERS_ARTICLE_INFLOW_PRODUCTION_FEED_URL`.
2. Cover flag-off/no-URL no-fetch behavior; `environment=production` acceptance; staging, network, HTTP, schema, checksum, and unsafe-body rejection; and whole-catalog repository fallback.
3. Cover repository priority for duplicate slugs and detail checksum values for both repository and inflow bodies.
4. Run the targeted test and record RED.
5. Implement `fetchProductionArticleInflowFeed`, `loadPublicArticleInflowCatalog`, and `loadPublicArticleInflowDetail` with a five-minute Next.js revalidation hint.
6. Re-run targeted contract/feed tests and confirm green.

## Task 3: Route detail, Today, and series through one public catalog

**Files:**
- Modify: `app/[locale]/articles/[slug]/page.tsx`
- Modify: `app/[locale]/articles/today/page.tsx`
- Modify: `app/[locale]/articles/series/[series]/page.tsx`
- Modify: `tests/app/articles-routes.test.ts`
- Create: `tests/app/article-inflow-public-routes.test.tsx`
- Regression: `tests/app/article-inflow-preview-routes.test.tsx`

1. Add failing source-boundary tests requiring all three public surfaces to import the shared public loader and forbidding direct feed fetches.
2. Add failing render tests for a dynamic inflow detail, repository fallback, 404, locale handling, exact checksum attributes, Today inclusion, series inclusion, and repository duplicate priority.
3. Confirm RED with the two route test files.
4. Replace repository-only route reads with the public catalog/detail boundary. Keep `generateStaticParams` repository-only while allowing unknown dynamic slugs and five-minute revalidation.
5. Render inflow bodies as Markdown-only MDX with executable JavaScript, JSX, ESM, and raw HTML blocked by the server boundary.
6. Emit `data-declared-body-checksum`, `data-rendered-body-checksum`, and source evidence on the public detail body container.
7. Keep home and G44 imports unchanged.
8. Re-run route and hidden-preview regression tests until green.

## Task 4: Add independent canonical checksum verification

**Files:**
- Create: `scripts/verify-article-inflow-route.mjs`
- Create: `tests/scripts/verify-article-inflow-route.test.mjs`
- Create: `docs/article-inflow-production.md`
- Modify: `package.json`

1. Add failing pure-function tests for success and for HTTP, slug, declared, rendered, exact-body, schema/environment, and missing-attribute mismatches.
2. Confirm RED because the verifier is absent.
3. Implement a read-only CLI that fetches the Production feed and canonical route with cache-busting, hashes the exact JSON `body` UTF-8 bytes, extracts both rendered attributes, and exits nonzero unless all values match and the route is HTTP 200.
4. Add a package script and document exact Production env keys, fail-closed behavior, Vercel deployment checks, evidence command/output, and all Acceptance Stop conditions.
5. Run verifier tests and confirm green without contacting or mutating Production.

## Task 5: Full verification and delivery

**Files:** all changed paths above only.

1. Run targeted tests, then `npm test`, `npm run typecheck`, and `npm run build`.
2. Inspect `git status`, `git diff --check`, and the full diff; confirm no home/G44/SDE/LMK changes and no generated artifacts.
3. Commit only explicit paths on `codex/p2-lvm-inflow-g1-site-route`, push, and open a LiveMakers PR.
4. Run an independent Claude Code Opus read-only review against `origin/main`; resolve findings with RED→GREEN tests and repeat verification/review as needed.
5. Merge only after the independent review and required checks are green, then verify the Vercel Production deployment.
6. Measure a generic canonical repository route to prove deployment health. Do not fabricate target evidence while the target is absent from Production feed.
7. When the authorized Production sequence makes the named target available, run the verifier and retain HTTP 200 plus declared/rendered/exact-body checksum evidence.
8. Report that first Production emission remains stopped until Acceptance (a), (b), and (c) are all satisfied and the PR #89-equivalent integrated SDE main SHA is received.
