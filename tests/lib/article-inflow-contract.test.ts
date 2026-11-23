import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { ArticleMeta } from "@/lib/articles/article-model";
import {
  ARTICLE_INFLOW_SCHEMA_VERSION,
  buildArticleInflowPublicCatalog,
  buildArticleInflowPreviewCatalog,
  calculateArticleBodyChecksum,
  mapInflowArticle,
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

  it("builds public hrefs while preserving repository priority and newest-first order", () => {
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
    const candidate = {
      ...validPayload().articles[0],
      published_at: "2026-07-19T01:00:00+00:00",
    };
    const feed = parseArticleInflowFeed({
      ...validPayload(),
      environment: "production",
      articles: [
        candidate,
        {
          ...candidate,
          slug: "repo-owned",
          title: "Feed must lose",
          published_at: "2026-07-20T00:00:00+00:00",
        },
      ],
    });

    const catalog = buildArticleInflowPublicCatalog(repository, feed);

    expect(catalog.articles.map((article) => article.articleId)).toEqual([
      "daily-intel-20260719-48cea1b8",
      "repo-owned",
    ]);
    expect(catalog.articles).toMatchObject([
      { source: "inflow", href: "/articles/daily-intel-20260719-48cea1b8" },
      { source: "repository", href: "/articles/repo-owned", titleJa: "Repository title" },
    ]);
  });
});

// 2026-11-23 (田平氏 GO・案 1): 発行側が印の無い Signal に search_index: false を付ける。
// 1 本の壊れた値で feed 全体を落とさない — 真偽値以外は無いものとして扱う
describe("article inflow contract — search_index", () => {
  function item(extra: Record<string, unknown>) {
    return { ...validPayload().articles[0], family: "signal", ...extra } as never;
  }

  it("carries search_index: false through to ArticleMeta.searchIndex", () => {
    expect(mapInflowArticle(item({ search_index: false }), "/articles").searchIndex).toBe(false);
  });

  it("carries search_index: true through as true", () => {
    expect(mapInflowArticle(item({ search_index: true }), "/articles").searchIndex).toBe(true);
  });

  it("leaves searchIndex undefined when the field is absent", () => {
    expect(mapInflowArticle(item({}), "/articles").searchIndex).toBeUndefined();
  });

  it.each([["the string false", "false"], ["zero", 0], ["null", null]])(
    "ignores %s instead of rejecting the article",
    (_label, value) => {
      expect(mapInflowArticle(item({ search_index: value }), "/articles").searchIndex).toBeUndefined();
    },
  );

  it("does not reject a whole feed because one article carries search_index", () => {
    const payload = validPayload();
    (payload.articles[0] as Record<string, unknown>).search_index = false;
    expect(parseArticleInflowFeed(payload)).not.toBeNull();
  });
});

// 2026-11-23 (田平氏 GO・案 A): サイクル予報の号が天気の 1 行 (forecast_note) を運ぶ。
// トップページの左の列のカードに出す。cycle-forecast だけ・壊れた値は無いものとして扱う
describe("article inflow contract — forecast_note", () => {
  const NOTE = "ビットコイン — 晴れ 1・くもり 4・雨 0（11 月 22 日の週）";
  function item(extra: Record<string, unknown>, family = "cycle-forecast") {
    return { ...validPayload().articles[0], family, ...extra } as never;
  }

  it("carries forecast_note of a cycle-forecast article to ArticleMeta.forecastNoteJa", () => {
    expect(mapInflowArticle(item({ forecast_note: NOTE }), "/articles").forecastNoteJa).toBe(NOTE);
  });

  it("leaves forecastNoteJa undefined when the field is absent", () => {
    expect(mapInflowArticle(item({}), "/articles").forecastNoteJa).toBeUndefined();
  });

  it("drops forecast_note on any family other than cycle-forecast", () => {
    expect(
      mapInflowArticle(item({ forecast_note: NOTE }, "signal"), "/articles").forecastNoteJa,
    ).toBeUndefined();
  });

  it.each([
    ["a number", 3],
    ["an empty string", "  "],
    ["a line break", "晴れ 1\nくもり 4"],
    ["more than 120 characters", "あ".repeat(121)],
  ])("ignores %s instead of rejecting the article", (_label, value) => {
    expect(
      mapInflowArticle(item({ forecast_note: value }), "/articles").forecastNoteJa,
    ).toBeUndefined();
  });

  it("does not reject a whole feed because one article carries forecast_note", () => {
    const payload = validPayload();
    (payload.articles[0] as Record<string, unknown>).forecast_note = NOTE;
    expect(parseArticleInflowFeed(payload)).not.toBeNull();
  });
});
