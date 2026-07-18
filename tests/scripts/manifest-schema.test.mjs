import { describe, expect, it } from "vitest";

import {
  ManifestRecordSchema,
  validateManifest,
} from "../../scripts/migrate-articles/manifest.schema.mjs";

const valid = {
  postId: "2026-07-10_STN_B_001",
  sourcePath:
    "07_DATA/content/drafts/SITIONjp/2026-07-10_STN_B_001_daily-intel.md",
  sourceRef: "worktree",
  sourceSha256: "a".repeat(64),
  family: "daily-intel",
  slug: "daily-intel-2026-07-10",
  titleJa: "停戦崩壊は宣言から交戦へ",
  titleOriginal: "📋 Daily Intel 7/10｜停戦崩壊は宣言から交戦へ",
  titleTransform: "strip_prefix",
  titlePrefix: "📋 Daily Intel 7/10｜",
  publishedAtJst: "2026-07-10T05:52:00+09:00",
  dataDate: null,
  lanes: [],
  sourceXUrl: "https://x.com/SITIONjp/status/2075278094286258379",
  evidenceKind: "log_verified",
  primaryUrl: null,
  archiveCommit: null,
  logId: "2026-07-10_STN_B_001",
  logUrl: "https://x.com/SITIONjp/status/2075278094286258379",
  logPublishedAtUtc: "2026-07-09T20:52:00+00:00",
  logTitle: "📋 Daily Intel 7/10｜停戦崩壊は宣言から交戦へ",
  titleMatch: "exact",
  bodySelector: "exact_marker",
  bodySourcePath: null,
  bodySourceSha256: null,
  publicH2s: [],
  internalH2s: [],
  h2ClassificationBasis: null,
  leadDuplicateLine: "📋 Daily Intel 7/10｜停戦崩壊は宣言から交戦へ",
  trailingHashtagLine: null,
  manualReviewedBy: null,
  manualReviewReason: null,
  timeBasis: null,
  forbiddenTermHits: [],
  bodyPatch: null,
  include: true,
  excludeReason: null,
  stage: 1,
};

describe("manifest schema v1.3", () => {
  it("accepts a valid log_verified record", () => {
    expect(() => ManifestRecordSchema.parse(valid)).not.toThrow();
  });

  it("rejects incomplete or non-SITIONjp log evidence", () => {
    expect(() => ManifestRecordSchema.parse({ ...valid, logUrl: null })).toThrow();
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        logUrl: "https://x.com/other/status/1",
        sourceXUrl: "https://x.com/other/status/1",
      }),
    ).toThrow(/SITIONjp/);
  });

  it("requires exact log identity and adopted URL identity", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        logId: "2026-07-10_STN_B_999",
      }),
    ).toThrow(/logId/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        sourceXUrl: "https://x.com/SITIONjp/status/999",
      }),
    ).toThrow(/evidence URL/);
  });

  it("requires versioned manual title review", () => {
    expect(() =>
      ManifestRecordSchema.parse({ ...valid, titleMatch: "manual" }),
    ).toThrow(/manualReview/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        titleMatch: "manual",
        manualReviewedBy: "codex",
        manualReviewReason:
          "log title は短縮版・原本タイトルと同一記事であることを本文照合で確認",
      }),
    ).not.toThrow();
  });

  it("requires primary fields for frontmatter/archive evidence", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        evidenceKind: "frontmatter",
        primaryUrl: null,
      }),
    ).toThrow();
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        evidenceKind: "archive",
        primaryUrl: "https://x.com/SITIONjp/status/1",
        archiveCommit: null,
      }),
    ).toThrow();
  });

  it("requires sourceXUrl for included records", () => {
    expect(() =>
      ManifestRecordSchema.parse({ ...valid, sourceXUrl: null }),
    ).toThrow(/sourceXUrl/);
  });

  it("enforces family, publish date, and dataDate slug relationships", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        slug: "signal-x-2026-07-10",
      }),
    ).toThrow(/family/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        slug: "daily-intel-2026-07-09",
      }),
    ).toThrow(/date/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        family: "mkt12-morning",
        slug: "mkt12-morning-2026-07-10",
        dataDate: "2026-07-09",
      }),
    ).toThrow(/dataDate/);
  });

  it("rejects non-mkt dataDate, duplicate lanes, and inconsistent stage", () => {
    expect(() =>
      ManifestRecordSchema.parse({ ...valid, dataDate: "2026-07-10" }),
    ).toThrow(/dataDate/);
    expect(() =>
      ManifestRecordSchema.parse({ ...valid, lanes: ["macro", "macro"] }),
    ).toThrow(/lanes/);
    expect(() => ManifestRecordSchema.parse({ ...valid, stage: 2 })).toThrow(
      /stage/,
    );
  });

  it("enforces exact title transformations", () => {
    expect(() =>
      ManifestRecordSchema.parse({ ...valid, titlePrefix: null }),
    ).toThrow(/titlePrefix/);
    expect(() =>
      ManifestRecordSchema.parse({ ...valid, titlePrefix: "📡 Signal｜" }),
    ).toThrow(/concatenation/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        titleTransform: "verbatim",
        titlePrefix: null,
        titleJa: valid.titleOriginal,
      }),
    ).not.toThrow();
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        titleTransform: "verbatim",
        titlePrefix: null,
      }),
    ).toThrow(/verbatim/);
  });

  it("enforces the snowflake time contract", () => {
    const snowflakeRecord = {
      ...valid,
      family: "deep-dive",
      slug: "deep-dive-warsh-fed-chair-policy-regime",
      evidenceKind: "frontmatter",
      primaryUrl: "https://x.com/SITIONjp/status/2058019904654319699",
      sourceXUrl: "https://x.com/SITIONjp/status/2058019904654319699",
      logId: null,
      logUrl: null,
      logPublishedAtUtc: null,
      logTitle: null,
      titleMatch: null,
      timeBasis: "snowflake_url",
      publishedAtJst: "2026-05-23T11:59:00+09:00",
      stage: 2,
    };
    expect(() => ManifestRecordSchema.parse(snowflakeRecord)).not.toThrow();
    expect(() =>
      ManifestRecordSchema.parse({
        ...snowflakeRecord,
        publishedAtJst: "2026-05-23T12:00:00+09:00",
      }),
    ).toThrow(/snowflake/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        timeBasis: "snowflake_url",
      }),
    ).toThrow(/log_verified/);
  });

  it("requires H2 classification basis exactly when headings are declared", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        publicH2s: ["## 1｜公開章"],
        internalH2s: ["## 編集メモ"],
      }),
    ).toThrow(/h2ClassificationBasis/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        publicH2s: ["## 1｜公開章"],
        internalH2s: ["## 編集メモ"],
        h2ClassificationBasis: "explicit_editorial_review",
      }),
    ).not.toThrow();
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        h2ClassificationBasis: "external_body",
      }),
    ).toThrow(/h2ClassificationBasis/);
  });

  it("couples external body selectors to path and sha", () => {
    expect(() =>
      ManifestRecordSchema.parse({ ...valid, bodySelector: "external_file" }),
    ).toThrow(/bodySourcePath/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        bodySourcePath: "07_DATA/content/drafts/SITIONjp/x.txt",
      }),
    ).toThrow(/external_file/);
  });

  it("rejects source paths outside the allowlist and traversal", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        sourcePath: "07_DATA/content/intelligence/raw.jsonl",
      }),
    ).toThrow(/allowed root/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        sourcePath: "07_DATA/content/drafts/SITIONjp/../secret.md",
      }),
    ).toThrow(/\.\./);
  });

  it("requires approved exact-count patches for forbidden hits", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        forbiddenTermHits: ["crawler"],
      }),
    ).toThrow(/forbidden/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        forbiddenTermHits: ["crawler"],
        bodyPatch: {
          approvedBy: "tabira",
          replacements: [{ from: "crawler", to: "収集系統" }],
        },
      }),
    ).toThrow(/expectedCount/);
  });

  it("requires reason and null stage on exclusions", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        include: false,
        excludeReason: null,
      }),
    ).toThrow(/excludeReason/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        include: false,
        excludeReason: "no publish evidence",
        stage: 1,
      }),
    ).toThrow(/stage/);
    expect(() =>
      ManifestRecordSchema.parse({
        ...valid,
        include: false,
        excludeReason: "no publish evidence",
        stage: null,
      }),
    ).not.toThrow();
  });

  it("rejects duplicate postId, source, or included slug", () => {
    expect(
      validateManifest([
        valid,
        {
          ...valid,
          postId: "x2",
          sourcePath: valid.sourcePath.replace(".md", "_2.md"),
          logId: "x2",
        },
      ]).ok,
    ).toBe(false);
    expect(
      validateManifest([
        valid,
        {
          ...valid,
          postId: "x2",
          slug: "daily-intel-2026-07-10-2",
          logId: "x2",
        },
      ]).ok,
    ).toBe(false);
    expect(
      validateManifest([
        valid,
        {
          ...valid,
          slug: "daily-intel-2026-07-10-2",
          sourcePath: valid.sourcePath.replace(".md", "_2.md"),
        },
      ]).ok,
    ).toBe(false);
  });

  it("re-derives daily-intel slots for every included record on a date", () => {
    const second = {
      ...valid,
      postId: "2026-07-10_STN_B_002",
      sourcePath: valid.sourcePath.replace("_001_", "_002_"),
      logId: "2026-07-10_STN_B_002",
      logUrl: "https://x.com/SITIONjp/status/2075999999999999999",
      sourceXUrl: "https://x.com/SITIONjp/status/2075999999999999999",
      publishedAtJst: "2026-07-10T12:10:00+09:00",
    };
    expect(
      validateManifest([
        valid,
        { ...second, slug: "daily-intel-2026-07-10-2" },
      ]).ok,
    ).toBe(false);
    expect(
      validateManifest([
        { ...valid, slug: "daily-intel-2026-07-10-morning" },
        { ...second, slug: "daily-intel-2026-07-10-midday" },
      ]).ok,
    ).toBe(true);
  });
});

describe("P0-4 interim recovery source roots", () => {
  const frontmatterRecovery = {
    ...valid,
    postId: "2026-07-16_STN_A_009",
    sourcePath:
      "08_DOCS/reports/manual_articles/2026-07-16/2026-07-16_STN_A_009_signal-fixture-topic.md",
    family: "signal",
    slug: "signal-fixture-topic-2026-07-16",
    titleJa: "フィクスチャの見出し——回収レコードの型",
    titleOriginal: "📡 Signal｜フィクスチャの見出し——回収レコードの型",
    titlePrefix: "📡 Signal｜",
    publishedAtJst: "2026-07-16T09:30:00+09:00",
    sourceXUrl: "https://x.com/SITIONjp/status/2077551452260859999",
    evidenceKind: "frontmatter",
    primaryUrl: "https://x.com/SITIONjp/status/2077551452260859999",
    logId: null,
    logUrl: null,
    logPublishedAtUtc: null,
    logTitle: null,
    titleMatch: null,
    leadDuplicateLine: "📡 Signal｜フィクスチャの見出し——回収レコードの型",
    trailingHashtagLine: "#Fixture #SITION",
  };

  it("accepts sourcePath under 08_DOCS/reports/manual_articles/", () => {
    expect(() =>
      ManifestRecordSchema.parse(frontmatterRecovery),
    ).not.toThrow();
  });

  it("accepts a future-map record under 08_DOCS/reports/next_era_map/", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...frontmatterRecovery,
        postId: "2026-07-12_STN_ARTICLE_099",
        sourcePath:
          "08_DOCS/reports/next_era_map/2026-07-12-fixture-map.md",
        family: "future-map",
        slug: "future-map-fixture-map",
        titleJa: "次の時代の地図 #99：フィクスチャ編",
        titleOriginal: "次の時代の地図 #99：フィクスチャ編",
        titleTransform: "verbatim",
        titlePrefix: null,
        publishedAtJst: "2026-07-12T09:00:00+09:00",
        sourceXUrl: "https://x.com/SITIONjp/status/2076079249010999999",
        primaryUrl: "https://x.com/SITIONjp/status/2076079249010999999",
        leadDuplicateLine: "次の時代の地図 #99：フィクスチャ編",
      }),
    ).not.toThrow();
  });

  it("still rejects sourcePath outside the allowed roots", () => {
    expect(() =>
      ManifestRecordSchema.parse({
        ...frontmatterRecovery,
        sourcePath: "08_DOCS/reports/other_dir/2026-07-16_STN_A_009.md",
      }),
    ).toThrow();
    expect(() =>
      ManifestRecordSchema.parse({
        ...frontmatterRecovery,
        sourcePath:
          "08_DOCS/reports/manual_articles/../../secrets/2026-07-16.md",
      }),
    ).toThrow();
  });
});
