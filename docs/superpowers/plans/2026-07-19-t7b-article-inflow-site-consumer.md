# T7b Article Inflow Site Consumer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume the versioned LiveMakers article-inflow staging feed through one server-only boundary and render it on a flag-gated, noindex preview surface with a measurable body-checksum match.

**Architecture:** A pure contract module validates the complete feed, including per-article green validator attestation and SHA-256 body checksums, then overlays accepted feed articles onto repository articles with repository slugs winning. A separate server-only module owns the sole network fetch and environment-variable boundary. Hidden list, series, and detail routes consume the shared overlay catalog; the detail route emits both the declared and recomputed body checksum around the exact Markdown body it renders.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Zod, Node.js `crypto`, `next-mdx-remote`, Vitest, Testing Library.

## Global Constraints

- Implementation repo: `/Users/sition/Documents/SITION/DEV/livemakers-site`; implementation worktree: `/Users/sition/Downloads/livemakers-site-t7b`.
- Base is current `origin/main`; preserve unrelated G47 and other dirty worktrees.
- Accepted schema version is exactly `livemakers_article_inflow_feed_v0`; additive unknown fields are allowed, every other version rejects the complete feed.
- Dedicated environment keys are exactly `LIVEMAKERS_ARTICLE_INFLOW_FEED_URL` and `LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED`.
- Only `lib/articles/article-inflow-feed.ts` may call `fetch`; pages, layouts, and client components must not fetch the feed or read its raw state.
- Fetch failure, non-2xx response, invalid JSON, invalid schema, missing validator attestation, non-green verdict, duplicate feed slug, or body checksum mismatch returns repository content only.
- Overlay de-duplicates by slug with repository content taking priority.
- The overlay catalog is used uniformly by hidden preview list, series, and article-detail routes.
- Preview is disabled unless the flag value is `1` or `true`, carries `noindex, nofollow`, has no navigation entry, and never changes production article routes or G44 home exposure.
- The rendered inflow body must expose its declared SHA-256 checksum and a fresh checksum recomputed from the exact string passed to the Markdown renderer.
- Do not add a runtime dependency. Do not use `git add .`; commit only named paths.

---

## File Structure

Create:

- `lib/articles/article-inflow-contract.ts`
  - Owns the Zod feed contract, checksum calculation, feed-to-article mapping, and repository-priority overlay.
- `lib/articles/article-inflow-feed.ts`
  - Owns the two environment keys, flag evaluation, sole server-only fetch, fail-closed catalog load, and detail-body resolution.
- `tests/lib/article-inflow-contract.test.ts`
  - Proves version, validator, checksum, duplicate, mapping, and repository-priority behavior.
- `tests/lib/article-inflow-feed.test.ts`
  - Proves the network boundary fails closed and accepts one valid response.
- `app/[locale]/article-inflow-preview/layout.tsx`
  - Applies the runtime flag and noindex metadata to the entire hidden namespace.
- `app/[locale]/article-inflow-preview/page.tsx`
  - Renders the complete overlay catalog.
- `app/[locale]/article-inflow-preview/series/[series]/page.tsx`
  - Renders the same overlay catalog filtered by family.
- `app/[locale]/article-inflow-preview/articles/[slug]/page.tsx`
  - Resolves and renders repository or inflow Markdown with checksum evidence.
- `tests/app/article-inflow-preview-routes.test.tsx`
  - Proves list, series, detail, body-checksum attributes, and no direct fetch.
- `docs/article-inflow-preview.md`
  - Records the internal-only environment contract and acceptance command.

Modify:

- `components/layout/SiteChrome.tsx`
  - Suppresses the public header/footer throughout the hidden preview namespace.
- `tests/components/layout/SiteChrome.test.tsx`
  - Covers nested article-inflow preview paths while retaining normal route chrome.

Do not modify:

- `app/[locale]/articles/**`
- `app/[locale]/page.tsx`
- `components/layout/Header.tsx`
- `components/layout/Footer.tsx`
- navigation messages or G44 home-surface code

## Task 1: Versioned Feed Contract And Server-Only Overlay

**Files:**
- Create: `lib/articles/article-inflow-contract.ts`
- Create: `lib/articles/article-inflow-feed.ts`
- Create: `tests/lib/article-inflow-contract.test.ts`
- Create: `tests/lib/article-inflow-feed.test.ts`

**Interfaces:**
- Consumes:
  - `ARTICLE_FAMILIES`, `ArticleMetaSchema`, `getAllArticles`, and `getArticleBody` from `@/lib/articles/article-model`.
  - Feed fields `schema_version`, `environment`, `generated_at`, `feed_checksum`, and `articles[]`.
- Produces:
  - `ARTICLE_INFLOW_SCHEMA_VERSION = "livemakers_article_inflow_feed_v0"`.
  - `calculateArticleBodyChecksum(body: string): string`.
  - `parseArticleInflowFeed(payload: unknown): ArticleInflowFeed | null`.
  - `buildArticleInflowPreviewCatalog(repositoryArticles: ArticleMeta[], feed: ArticleInflowFeed | null): ArticleInflowPreviewCatalog`.
  - `isArticleInflowPreviewEnabled(): boolean`.
  - `fetchArticleInflowFeed(fetcher?: typeof fetch): Promise<ArticleInflowFeed | null>`.
  - `loadArticleInflowPreviewCatalog(): Promise<ArticleInflowPreviewCatalog>`.
  - `loadArticleInflowPreviewDetail(slug: string, locale: "ja" | "en"): Promise<ArticleInflowPreviewDetail | null>`.

- [ ] **Step 1: Write failing contract tests**

Create `tests/lib/article-inflow-contract.test.ts` with a fixture factory whose body checksum is computed by Node `crypto`. Assert that a valid feed parses; unknown versions, missing validators, non-green validators, duplicate slugs, and mismatched body checksums return `null`. Assert that overlay output contains the feed-only article, maps its href into `/article-inflow-preview/articles/<slug>`, and retains repository title/body ownership on a duplicate slug.

```ts
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import {
  ARTICLE_INFLOW_SCHEMA_VERSION,
  buildArticleInflowPreviewCatalog,
  calculateArticleBodyChecksum,
  parseArticleInflowFeed,
} from "@/lib/articles/article-inflow-contract";

const BODY = "# Staging body\n\nExact bytes.\n";

function validPayload() {
  return {
    schema_version: ARTICLE_INFLOW_SCHEMA_VERSION,
    environment: "staging",
    generated_at: "2026-07-19T09:56:11.862371+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles: [
      {
        slug: "daily-intel-20260719-48cea1b8",
        title: "Staging Daily Intel",
        family: "daily-intel",
        source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
        published_at: "2026-07-18T22:20:14.874652+00:00",
        body: BODY,
        body_checksum: createHash("sha256").update(BODY, "utf8").digest("hex"),
        validator: { verdict: "green", vocabulary_version: "99f41b7549a0a4f5" },
      },
    ],
  };
}

describe("article inflow contract", () => {
  it("accepts one valid additive feed and recomputes its body checksum", () => {
    const payload = { ...validPayload(), additive_top_level: true };
    const parsed = parseArticleInflowFeed(payload);
    expect(parsed?.articles[0].body).toBe(BODY);
    expect(calculateArticleBodyChecksum(BODY)).toBe(
      createHash("sha256").update(BODY, "utf8").digest("hex"),
    );
  });

  it.each([
    ["unknown version", (value: any) => (value.schema_version = "v99")],
    ["missing validator", (value: any) => delete value.articles[0].validator],
    ["non-green validator", (value: any) => (value.articles[0].validator.verdict = "red")],
    ["body mismatch", (value: any) => (value.articles[0].body_checksum = "0".repeat(64))],
    ["duplicate slug", (value: any) => value.articles.push({ ...value.articles[0] })],
  ])("rejects the complete feed for %s", (_label, mutate) => {
    const payload = validPayload();
    mutate(payload);
    expect(parseArticleInflowFeed(payload)).toBeNull();
  });

  it("overlays feed-only rows while repository slugs keep priority", () => {
    const repository: ArticleMeta[] = [
      {
        articleId: "repo-owned",
        family: "daily-intel",
        titleJa: "Repository title",
        publishedAtJst: "2026-07-19T08:00:00+09:00",
        publishedLabel: "07-19 08:00 公開",
        lanes: [],
        href: "/articles/repo-owned",
      },
    ];
    const payload = validPayload();
    payload.articles.push({
      ...payload.articles[0],
      slug: "repo-owned",
      title: "Feed must lose",
    });
    const duplicate = payload.articles[1];
    duplicate.body_checksum = createHash("sha256").update(duplicate.body, "utf8").digest("hex");
    const feed = parseArticleInflowFeed(payload);
    const catalog = buildArticleInflowPreviewCatalog(repository, feed);
    expect(catalog.articles.map((article) => article.articleId)).toContain(
      "daily-intel-20260719-48cea1b8",
    );
    expect(catalog.articles.find((article) => article.articleId === "repo-owned")).toMatchObject({
      titleJa: "Repository title",
      source: "repository",
      href: "/article-inflow-preview/articles/repo-owned",
    });
  });
});
```

- [ ] **Step 2: Run contract tests and verify RED**

Run:

```bash
npm test -- tests/lib/article-inflow-contract.test.ts
```

Expected: FAIL because `@/lib/articles/article-inflow-contract` does not exist.

- [ ] **Step 3: Implement the pure feed contract and overlay**

Create `lib/articles/article-inflow-contract.ts`. Use a passthrough top-level and article object so additive fields remain compatible, but make every named field strict in type and value. In `superRefine`, report duplicate slugs and every checksum mismatch. Return `null` from `parseArticleInflowFeed` on any issue. Convert `published_at` to an explicit JST ISO string, derive the label, add `dataDate` for MKT12 families, validate the mapped object with `ArticleMetaSchema`, and then attach the hidden-preview href and source.

```ts
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  ARTICLE_FAMILIES,
  ArticleMetaSchema,
  type ArticleMeta,
} from "@/lib/articles/article-model";

export const ARTICLE_INFLOW_SCHEMA_VERSION = "livemakers_article_inflow_feed_v0";
const CHECKSUM = /^[0-9a-f]{64}$/;
const RESERVED_SLUGS = new Set(["today", "series", "archive"]);

const ArticleInflowItemSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/).refine((slug) => !RESERVED_SLUGS.has(slug)),
    title: z.string().min(1),
    family: z.enum(ARTICLE_FAMILIES),
    source_x_url: z.string().regex(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/),
    published_at: z.string().datetime({ offset: true }),
    body: z.string().min(1),
    body_checksum: z.string().regex(CHECKSUM),
    validator: z.object({
      verdict: z.literal("green"),
      vocabulary_version: z.string().min(1),
    }).passthrough(),
  })
  .passthrough();

const ArticleInflowFeedSchema = z
  .object({
    schema_version: z.literal(ARTICLE_INFLOW_SCHEMA_VERSION),
    environment: z.enum(["staging", "production"]),
    generated_at: z.string().datetime({ offset: true }),
    feed_checksum: z.string().regex(/^[0-9a-f]{16}$/),
    articles: z.array(ArticleInflowItemSchema),
  })
  .passthrough()
  .superRefine((feed, context) => {
    const slugs = new Set<string>();
    feed.articles.forEach((article, index) => {
      if (slugs.has(article.slug)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["articles", index, "slug"], message: "duplicate slug" });
      }
      slugs.add(article.slug);
      if (calculateArticleBodyChecksum(article.body) !== article.body_checksum) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["articles", index, "body_checksum"], message: "body checksum mismatch" });
      }
    });
  });

export type ArticleInflowFeed = z.infer<typeof ArticleInflowFeedSchema>;
export type ArticleInflowPreviewArticle = ArticleMeta & {
  source: "repository" | "inflow";
  declaredBodyChecksum?: string;
  inflowBody?: string;
};
export interface ArticleInflowPreviewCatalog {
  articles: ArticleInflowPreviewArticle[];
  feedChecksum: string | null;
}

export function calculateArticleBodyChecksum(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function parseArticleInflowFeed(payload: unknown): ArticleInflowFeed | null {
  const result = ArticleInflowFeedSchema.safeParse(payload);
  return result.success ? result.data : null;
}

function toJstParts(value: string) {
  const jst = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  const date = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
  const time = `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  return { date, time, iso: `${date}T${time}:${pad(jst.getUTCSeconds())}+09:00` };
}

function mapInflowArticle(article: ArticleInflowFeed["articles"][number]): ArticleInflowPreviewArticle {
  const jst = toJstParts(article.published_at);
  const parsed = ArticleMetaSchema.parse({
    articleId: article.slug,
    family: article.family,
    titleJa: article.title,
    publishedAtJst: jst.iso,
    publishedLabel: `${jst.date.slice(5)} ${jst.time} 公開`,
    dataDate: article.family.startsWith("mkt12-") ? jst.date : undefined,
    lanes: [],
    sourceXUrl: article.source_x_url,
  });
  return {
    ...parsed,
    href: `/article-inflow-preview/articles/${article.slug}`,
    source: "inflow",
    declaredBodyChecksum: article.body_checksum,
    inflowBody: article.body,
  };
}

export function buildArticleInflowPreviewCatalog(
  repositoryArticles: ArticleMeta[],
  feed: ArticleInflowFeed | null,
): ArticleInflowPreviewCatalog {
  const repositorySlugs = new Set(repositoryArticles.map((article) => article.articleId));
  const repository = repositoryArticles.map((article) => ({
    ...article,
    href: `/article-inflow-preview/articles/${article.articleId}`,
    source: "repository" as const,
  }));
  const inflow = (feed?.articles ?? [])
    .filter((article) => !repositorySlugs.has(article.slug))
    .map(mapInflowArticle);
  return {
    articles: [...repository, ...inflow].sort((left, right) =>
      right.publishedAtJst.localeCompare(left.publishedAtJst),
    ),
    feedChecksum: feed?.feed_checksum ?? null,
  };
}
```

- [ ] **Step 4: Run contract tests and verify GREEN**

Run:

```bash
npm test -- tests/lib/article-inflow-contract.test.ts
```

Expected: the new test file passes with no warnings.

- [ ] **Step 5: Write failing server-boundary tests**

Create `tests/lib/article-inflow-feed.test.ts`. Mock `server-only` before importing the module, preserve and restore the two environment variables, and inject a `vi.fn()` fetcher. Prove unset URL performs no request, thrown/non-OK/invalid JSON/invalid contract all return `null`, and one valid response returns the parsed feed. Prove flag values `1` and `true` enable while missing or any other value disables. Spy on `console.warn` in degradation cases so the warning contract is asserted without noisy test output.

```ts
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_FEED_ENV_KEY,
  ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY,
  fetchArticleInflowFeed,
  isArticleInflowPreviewEnabled,
} from "@/lib/articles/article-inflow-feed";

const originalUrl = process.env.LIVEMAKERS_ARTICLE_INFLOW_FEED_URL;
const originalFlag = process.env.LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED;

function payload() {
  const body = "# Exact body\n";
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "staging",
    generated_at: "2026-07-19T09:56:11.862371+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles: [{
      slug: "daily-intel-20260719-48cea1b8",
      title: "Daily Intel",
      family: "daily-intel",
      source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
      published_at: "2026-07-18T22:20:14.874652+00:00",
      body,
      body_checksum: createHash("sha256").update(body, "utf8").digest("hex"),
      validator: { verdict: "green", vocabulary_version: "99f41b7549a0a4f5" },
    }],
  };
}

afterEach(() => {
  if (originalUrl === undefined) delete process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
  else process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = originalUrl;
  if (originalFlag === undefined) delete process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
  else process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY] = originalFlag;
  vi.restoreAllMocks();
});

describe("article inflow server boundary", () => {
  it("does not fetch when the dedicated URL is absent", async () => {
    delete process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
    const fetcher = vi.fn();
    expect(await fetchArticleInflowFeed(fetcher as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["throws", "non-ok", "invalid-json", "invalid-contract"])(
    "fails closed when the request %s",
    async (mode) => {
      process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = "https://example.test/feed.json";
      const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const fetcher = vi.fn(async () => {
        if (mode === "throws") throw new Error("offline");
        if (mode === "non-ok") return { ok: false };
        return {
          ok: true,
          json: async () => {
            if (mode === "invalid-json") throw new Error("bad json");
            if (mode === "invalid-contract") return { schema_version: "wrong" };
            return payload();
          },
        };
      });
      expect(await fetchArticleInflowFeed(fetcher as unknown as typeof fetch)).toBeNull();
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining("repository-only"),
      );
    },
  );

  it("returns a fully validated feed", async () => {
    process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = "https://example.test/feed.json";
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => payload() }));
    const feed = await fetchArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(feed?.feed_checksum).toBe("8f36d3924040c7aa");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([[undefined, false], ["0", false], ["false", false], ["1", true], ["true", true]])(
    "maps flag %s to %s",
    (value, expected) => {
      if (value === undefined) delete process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
      else process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY] = value;
      expect(isArticleInflowPreviewEnabled()).toBe(expected);
    },
  );
});
```

- [ ] **Step 6: Run server-boundary tests and verify RED**

Run:

```bash
npm test -- tests/lib/article-inflow-feed.test.ts
```

Expected: FAIL because `@/lib/articles/article-inflow-feed` does not exist.

- [ ] **Step 7: Implement the sole server-only fetch and detail loader**

Create `lib/articles/article-inflow-feed.ts`. Every configured-feed degradation must warn without logging the URL or payload, then fail closed to repository-only content. The detail loader must pass the exact `inflowBody` string to callers and calculate repository checksums locally.

```ts
import "server-only";

import {
  getAllArticles,
  getArticleBody,
} from "@/lib/articles/article-model";
import {
  buildArticleInflowPreviewCatalog,
  calculateArticleBodyChecksum,
  parseArticleInflowFeed,
  type ArticleInflowFeed,
  type ArticleInflowPreviewArticle,
  type ArticleInflowPreviewCatalog,
} from "@/lib/articles/article-inflow-contract";

export const ARTICLE_INFLOW_FEED_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_FEED_URL";
export const ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED";

export interface ArticleInflowPreviewDetail {
  article: ArticleInflowPreviewArticle;
  body: string;
  declaredBodyChecksum: string;
  renderedBodyChecksum: string;
}

export function isArticleInflowPreviewEnabled(): boolean {
  const value = process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
  return value === "1" || value === "true";
}

export async function fetchArticleInflowFeed(
  fetcher: typeof fetch = fetch,
): Promise<ArticleInflowFeed | null> {
  const url = process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
  if (!url) return null;
  try {
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      console.warn("[article-inflow] feed response rejected; using repository-only content");
      return null;
    }
    const feed = parseArticleInflowFeed(await response.json());
    if (!feed) {
      console.warn("[article-inflow] feed contract rejected; using repository-only content");
    }
    return feed;
  } catch {
    console.warn("[article-inflow] feed request failed; using repository-only content");
    return null;
  }
}

export async function loadArticleInflowPreviewCatalog(): Promise<ArticleInflowPreviewCatalog> {
  return buildArticleInflowPreviewCatalog(getAllArticles(), await fetchArticleInflowFeed());
}

export async function loadArticleInflowPreviewDetail(
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPreviewDetail | null> {
  const catalog = await loadArticleInflowPreviewCatalog();
  const article = catalog.articles.find((candidate) => candidate.articleId === slug);
  if (!article) return null;
  const body = article.source === "inflow"
    ? article.inflowBody!
    : getArticleBody(slug, locale);
  const renderedBodyChecksum = calculateArticleBodyChecksum(body);
  return {
    article,
    body,
    declaredBodyChecksum: article.declaredBodyChecksum ?? renderedBodyChecksum,
    renderedBodyChecksum,
  };
}
```

- [ ] **Step 8: Run focused and full task verification**

Run:

```bash
npm test -- tests/lib/article-inflow-contract.test.ts tests/lib/article-inflow-feed.test.ts
npm run typecheck
```

Expected: both test files pass with no warnings; typecheck exits `0`.

- [ ] **Step 9: Commit Task 1 exactly**

```bash
git add lib/articles/article-inflow-contract.ts lib/articles/article-inflow-feed.ts tests/lib/article-inflow-contract.test.ts tests/lib/article-inflow-feed.test.ts
git commit -m "feat: add article inflow feed consumer"
```

## Task 2: Flag-Gated Hidden Preview Routes And Checksum Evidence

**Files:**
- Create: `app/[locale]/article-inflow-preview/layout.tsx`
- Create: `app/[locale]/article-inflow-preview/page.tsx`
- Create: `app/[locale]/article-inflow-preview/series/[series]/page.tsx`
- Create: `app/[locale]/article-inflow-preview/articles/[slug]/page.tsx`
- Create: `tests/app/article-inflow-preview-routes.test.tsx`
- Create: `docs/article-inflow-preview.md`
- Modify: `components/layout/SiteChrome.tsx`
- Modify: `tests/components/layout/SiteChrome.test.tsx`

**Interfaces:**
- Consumes:
  - `loadArticleInflowPreviewCatalog`, `loadArticleInflowPreviewDetail`, and `isArticleInflowPreviewEnabled` from Task 1.
  - `SERIES_SLUGS` and `SeriesSlug` from `@/lib/articles/article-model`.
- Produces:
  - Hidden namespace `/[locale]/article-inflow-preview`.
  - Hidden series namespace `/[locale]/article-inflow-preview/series/[series]`.
  - Hidden detail namespace `/[locale]/article-inflow-preview/articles/[slug]`.
  - Detail evidence attributes `data-declared-body-checksum` and `data-rendered-body-checksum` on the element containing the exact Markdown renderer input.

- [ ] **Step 1: Write failing preview route and chrome tests**

Create `tests/app/article-inflow-preview-routes.test.tsx`. Mock the Task 1 server loader, `next-intl/server`, `next/navigation`, and `next-mdx-remote/rsc`; call each async Server Component directly. Assert list includes repository and feed rows whose links stay in the preview namespace, series excludes other families, detail renders the exact body with equal declared/rendered checksum attributes, and an unknown slug invokes `notFound`. Read all four route source files and assert none contains `fetch(`.

```tsx
/* @vitest-environment jsdom */
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  loadDetail: vi.fn(),
  enabled: vi.fn(() => true),
  notFound: vi.fn((): never => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: ({ source }: { source: string }) => <div data-testid="rendered-markdown">{source}</div>,
}));
vi.mock("remark-gfm", () => ({ default: vi.fn() }));
vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadArticleInflowPreviewCatalog: mocks.loadCatalog,
  loadArticleInflowPreviewDetail: mocks.loadDetail,
  isArticleInflowPreviewEnabled: mocks.enabled,
}));

import PreviewLayout from "@/app/[locale]/article-inflow-preview/layout";
import PreviewPage from "@/app/[locale]/article-inflow-preview/page";
import PreviewDetailPage from "@/app/[locale]/article-inflow-preview/articles/[slug]/page";
import PreviewSeriesPage from "@/app/[locale]/article-inflow-preview/series/[series]/page";

const checksum = "5df91fa04b4c09f201d60beb7c13c051f01e1c82d15bb55075742aba4875f7d8";
const articles = [
  {
    articleId: "repo-owned",
    family: "signal",
    titleJa: "Repository article",
    publishedAtJst: "2026-07-19T08:00:00+09:00",
    publishedLabel: "07-19 08:00 公開",
    lanes: [],
    href: "/article-inflow-preview/articles/repo-owned",
    source: "repository",
  },
  {
    articleId: "daily-intel-20260719-48cea1b8",
    family: "daily-intel",
    titleJa: "Feed article",
    publishedAtJst: "2026-07-19T07:20:14+09:00",
    publishedLabel: "07-19 07:20 公開",
    lanes: [],
    href: "/article-inflow-preview/articles/daily-intel-20260719-48cea1b8",
    source: "inflow",
    declaredBodyChecksum: checksum,
    inflowBody: "# Exact body\n",
  },
];

beforeEach(() => {
  mocks.enabled.mockReturnValue(true);
  mocks.loadCatalog.mockResolvedValue({ articles, feedChecksum: "8f36d3924040c7aa" });
  mocks.loadDetail.mockResolvedValue({
    article: articles[1],
    body: "# Exact body\n",
    declaredBodyChecksum: checksum,
    renderedBodyChecksum: checksum,
  });
  mocks.notFound.mockClear();
});

describe("article inflow preview routes", () => {
  it("fails closed at the namespace layout when the flag is disabled", () => {
    mocks.enabled.mockReturnValue(false);
    expect(() => PreviewLayout({ children: <p>hidden</p> })).toThrow("NEXT_NOT_FOUND");
  });

  it("renders repository and feed articles using preview-only links", async () => {
    render(await PreviewPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getByText("Repository article")).toBeInTheDocument();
    expect(screen.getByText("Feed article")).toHaveAttribute(
      "href",
      "/article-inflow-preview/articles/daily-intel-20260719-48cea1b8",
    );
    expect(screen.getByTestId("article-inflow-feed-checksum")).toHaveTextContent("8f36d3924040c7aa");
  });

  it("filters the shared catalog on a valid series", async () => {
    render(await PreviewSeriesPage({ params: Promise.resolve({ locale: "ja", series: "daily-intel" }) }));
    expect(screen.getByText("Feed article")).toBeInTheDocument();
    expect(screen.queryByText("Repository article")).toBeNull();
  });

  it("renders the exact body with matching declared and rendered checksums", async () => {
    render(await PreviewDetailPage({ params: Promise.resolve({ locale: "ja", slug: articles[1].articleId }) }));
    const body = screen.getByTestId("article-inflow-preview-body");
    expect(body).toHaveAttribute("data-declared-body-checksum", checksum);
    expect(body).toHaveAttribute("data-rendered-body-checksum", checksum);
    expect(screen.getByTestId("rendered-markdown")).toHaveTextContent("# Exact body");
  });

  it("returns not found for an unknown detail slug", async () => {
    mocks.loadDetail.mockResolvedValue(null);
    await expect(
      PreviewDetailPage({ params: Promise.resolve({ locale: "ja", slug: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("keeps every route free of direct feed fetches", () => {
    const routeFiles = [
      "app/[locale]/article-inflow-preview/layout.tsx",
      "app/[locale]/article-inflow-preview/page.tsx",
      "app/[locale]/article-inflow-preview/series/[series]/page.tsx",
      "app/[locale]/article-inflow-preview/articles/[slug]/page.tsx",
    ];
    for (const relativePath of routeFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
      expect(source).not.toContain("fetch(");
    }
  });
});
```

Add this case to `tests/components/layout/SiteChrome.test.tsx`:

```tsx
it("removes shared site chrome from nested article inflow preview routes", () => {
  mockedUsePathname.mockReturnValue(
    "/ja/article-inflow-preview/articles/daily-intel-20260719-48cea1b8",
  );

  render(
    <SiteChrome chromeMeta={chromeMeta} futureAtlasNav={false}>
      <div>Inflow Preview</div>
    </SiteChrome>,
  );

  expect(screen.getByText("Inflow Preview")).toBeInTheDocument();
  expect(screen.queryByTestId("site-header")).toBeNull();
  expect(screen.queryByTestId("site-footer")).toBeNull();
});
```

- [ ] **Step 2: Run preview tests and verify RED**

Run:

```bash
npm test -- tests/app/article-inflow-preview-routes.test.tsx tests/components/layout/SiteChrome.test.tsx
```

Expected: FAIL because the preview route modules do not exist and SiteChrome still recognizes only terminal preview.

- [ ] **Step 3: Implement the namespace gate and noindex metadata**

Create `app/[locale]/article-inflow-preview/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isArticleInflowPreviewEnabled } from "@/lib/articles/article-inflow-feed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "LiveMakers Article Inflow Preview",
  robots: { index: false, follow: false },
};

export default function ArticleInflowPreviewLayout({ children }: { children: React.ReactNode }) {
  if (!isArticleInflowPreviewEnabled()) notFound();
  return children;
}
```

- [ ] **Step 4: Implement the overlay list and series routes**

Create `app/[locale]/article-inflow-preview/page.tsx` and `app/[locale]/article-inflow-preview/series/[series]/page.tsx`. Both call `loadArticleInflowPreviewCatalog()` and render links using each article's already-mapped `href`. The root must display `feedChecksum ?? "repository-only"`; the series route must validate against `SERIES_SLUGS` before filtering the same catalog.

```tsx
// app/[locale]/article-inflow-preview/page.tsx
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadArticleInflowPreviewCatalog } from "@/lib/articles/article-inflow-feed";

export default async function ArticleInflowPreviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const catalog = await loadArticleInflowPreviewCatalog();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">T7b hidden preview</p>
      <h1 className="mt-2 text-3xl font-bold text-text-primary">Article inflow overlay</h1>
      <p data-testid="article-inflow-feed-checksum" className="mt-3 font-mono text-xs text-text-tertiary">
        feed checksum: {catalog.feedChecksum ?? "repository-only"}
      </p>
      <ul className="mt-6 divide-y divide-border-primary border-y border-border-primary">
        {catalog.articles.map((article) => (
          <li key={article.articleId} className="py-4">
            <p className="font-mono text-[10px] uppercase text-text-tertiary">{article.family} · {article.source}</p>
            <Link href={article.href} className="mt-1 block font-semibold text-text-primary underline underline-offset-4">
              {article.titleJa}
            </Link>
            <Link href={`/article-inflow-preview/series/${article.family}`} className="mt-1 inline-block text-xs text-text-secondary">
              series preview
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

```tsx
// app/[locale]/article-inflow-preview/series/[series]/page.tsx
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SERIES_SLUGS, type SeriesSlug } from "@/lib/articles/article-model";
import { loadArticleInflowPreviewCatalog } from "@/lib/articles/article-inflow-feed";

function isSeriesSlug(value: string): value is SeriesSlug {
  return SERIES_SLUGS.includes(value as SeriesSlug);
}

export default async function ArticleInflowPreviewSeriesPage({ params }: { params: Promise<{ locale: string; series: string }> }) {
  const { locale, series } = await params;
  setRequestLocale(locale);
  if (!isSeriesSlug(series)) notFound();
  const catalog = await loadArticleInflowPreviewCatalog();
  const articles = catalog.articles.filter((article) => article.family === series);
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-label text-text-tertiary">T7b hidden series preview</p>
      <h1 className="mt-2 text-3xl font-bold text-text-primary">{series}</h1>
      <ul className="mt-6 divide-y divide-border-primary border-y border-border-primary">
        {articles.map((article) => (
          <li key={article.articleId} className="py-4">
            <Link href={article.href} className="font-semibold text-text-primary underline underline-offset-4">{article.titleJa}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Implement detail rendering and checksum evidence**

Create `app/[locale]/article-inflow-preview/articles/[slug]/page.tsx`. The checksum attributes must sit on the wrapper whose `MDXRemote` receives `detail.body`; do not normalize or trim the string.

```tsx
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { loadArticleInflowPreviewDetail } from "@/lib/articles/article-inflow-feed";

export default async function ArticleInflowPreviewDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const language = locale === "en" ? "en" : "ja";
  const detail = await loadArticleInflowPreviewDetail(slug, language);
  if (!detail) notFound();
  return (
    <article className="mx-auto w-full max-w-[72ch] px-4 py-10 sm:px-6">
      <header className="mb-8 border-b border-border-primary pb-6">
        <p className="font-mono text-[10px] uppercase text-text-tertiary">T7b hidden preview · {detail.article.source}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-text-primary">{detail.article.titleJa}</h1>
        <time className="mt-4 block font-mono text-xs text-text-tertiary">{detail.article.publishedLabel}</time>
      </header>
      <div
        data-testid="article-inflow-preview-body"
        data-declared-body-checksum={detail.declaredBodyChecksum}
        data-rendered-body-checksum={detail.renderedBodyChecksum}
        className="prose prose-neutral max-w-none dark:prose-invert"
      >
        <MDXRemote source={detail.body} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
      </div>
    </article>
  );
}
```

- [ ] **Step 6: Suppress chrome throughout the hidden namespace**

Replace the preview predicate in `components/layout/SiteChrome.tsx` with one that preserves terminal-preview behavior and matches every article-inflow-preview descendant:

```ts
function isHiddenPreviewPath(pathname: string): boolean {
  return /^\/(?:en\/|ja\/)?terminal-preview\/?$/.test(pathname)
    || /^\/(?:en\/|ja\/)?article-inflow-preview(?:\/|$)/.test(pathname);
}
```

Use `isHiddenPreviewPath(pathname)` at the existing return branch.

- [ ] **Step 7: Add the internal environment contract**

Create `docs/article-inflow-preview.md`:

```markdown
# Article inflow hidden preview

This internal T7b surface is unavailable unless both variables are configured at runtime:

- `LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED=true`
- `LIVEMAKERS_ARTICLE_INFLOW_FEED_URL=<versioned JSON feed URL>`

The only network reader is `lib/articles/article-inflow-feed.ts`. Any fetch, JSON, schema, validator, duplicate-slug, or body-checksum failure returns the repository-only catalog. Repository slugs win over matching feed slugs.

The preview namespace is `/ja/article-inflow-preview` (or `/en/article-inflow-preview`), has no public navigation entry, and is marked `noindex, nofollow`. Production `/articles`, home, and G44 surfaces do not consume this catalog.

For T7b acceptance, open the feed-only detail route and compare `data-declared-body-checksum` with `data-rendered-body-checksum` on `[data-testid="article-inflow-preview-body"]`. The values must be identical to the feed article's `body_checksum`.
```

- [ ] **Step 8: Run focused preview tests and verify GREEN**

Run:

```bash
npm test -- tests/app/article-inflow-preview-routes.test.tsx tests/components/layout/SiteChrome.test.tsx
npm run typecheck
```

Expected: both test files pass with no warnings; typecheck exits `0`.

- [ ] **Step 9: Run full regression verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: the full Vitest suite, typecheck, and production build all exit `0`. Existing known Next.js build diagnostics may remain, but no new diagnostic may identify article-inflow files.

- [ ] **Step 10: Commit Task 2 exactly**

```bash
git add 'app/[locale]/article-inflow-preview/layout.tsx' 'app/[locale]/article-inflow-preview/page.tsx' 'app/[locale]/article-inflow-preview/series/[series]/page.tsx' 'app/[locale]/article-inflow-preview/articles/[slug]/page.tsx' components/layout/SiteChrome.tsx tests/app/article-inflow-preview-routes.test.tsx tests/components/layout/SiteChrome.test.tsx docs/article-inflow-preview.md
git commit -m "feat: add hidden article inflow preview"
```

## Controller Acceptance After Both Tasks

- [ ] Confirm `git diff origin/main...HEAD -- app/[locale]/articles app/[locale]/page.tsx components/layout/Header.tsx components/layout/Footer.tsx` is empty.
- [ ] Start the site with the two staging environment variables and request `/ja/article-inflow-preview/articles/daily-intel-20260719-48cea1b8`.
- [ ] Confirm HTTP `200`, the feed title and body render, and both rendered evidence attributes equal `5df91fa04b4c09f201d60beb7c13c051f01e1c82d15bb55075742aba4875f7d8`.
- [ ] Disable the preview flag and confirm the same URL returns `404`.
- [ ] Run final whole-branch review against the recorded merge base, then fresh `npm test`, `npm run typecheck`, and `npm run build` before reporting completion.
