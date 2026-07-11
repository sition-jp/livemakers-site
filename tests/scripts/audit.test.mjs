import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditSourceRoot } from "../../scripts/migrate-articles/audit.mjs";

const sourceRoot = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "audit-sources",
);

describe("article migration audit", () => {
  it("classifies all body selectors and collapses location copies", () => {
    const result = auditSourceRoot(sourceRoot, { includeArchive: false });
    expect(result.records).toHaveLength(9);
    expect(new Set(result.records.map((record) => record.bodySelector))).toEqual(
      new Set([
        "exact_marker",
        "decorated_marker",
        "xcopy_marker",
        "full_after_frontmatter",
        "external_file",
      ]),
    );
    const copied = result.records.find(
      (record) => record.audit.rawPostId === "2026-06-18_STN_A_001",
    );
    expect(copied.sourcePath).toBe(
      "07_DATA/content/drafts/SITIONjp/2026-06-18_STN_A_001_signal-policy.md",
    );
    expect(copied.audit.sourceLocations).toHaveLength(2);
    expect(
      result.records.some((record) =>
        /(?:thumbnail_prompts|review_notes)/.test(record.sourcePath),
      ),
    ).toBe(false);
    const crossLocation = result.records.filter(
      (record) => record.audit.rawPostId === "2026-07-04_STN_MKT_001",
    );
    expect(crossLocation).toHaveLength(1);
    expect(crossLocation[0].sourcePath).toBe(
      "07_DATA/content/drafts/SITIONjp/2026-07-04_STN_MKT_001_weekend_12-indicators.md",
    );
    expect(crossLocation[0].titleOriginal).toContain("SITION 12指標");
  });

  it("assigns deterministic daily slots and resolves duplicate postIds by source stem", () => {
    const result = auditSourceRoot(sourceRoot, { includeArchive: false });
    const dailies = result.records
      .filter((record) => record.family === "daily-intel")
      .map((record) => record.slug)
      .sort();
    expect(dailies).toEqual([
      "daily-intel-2026-07-10-midday",
      "daily-intel-2026-07-10-morning",
    ]);

    const collision = result.records.filter(
      (record) => record.audit.rawPostId === "2026-06-09_STN_A_001",
    );
    expect(collision).toHaveLength(2);
    expect(collision.every((record) => record.family === "signal")).toBe(true);
    expect(collision.map((record) => record.postId).sort()).toEqual([
      "2026-06-09_STN_A_001_signal-developer-rule",
      "2026-06-09_STN_A_001_signal-tax-branch",
    ]);
    expect(collision.filter((record) => record.include)).toHaveLength(1);
    expect(collision.find((record) => !record.include).excludeReason).toMatch(
      /postId collision unresolved/,
    );
  });

  it("keeps excluded daily records slug-unique for whole-manifest validation", async () => {
    const { assignDailySlugs } = await import(
      "../../scripts/migrate-articles/audit.mjs"
    );
    const records = [1, 2].map((number) => ({
      postId: `2026-04-19_STN_B_00${number}`,
      family: "daily-intel",
      include: false,
      publishedAtJst: "2026-04-19T00:00:00+09:00",
      slug: "pending",
    }));
    assignDailySlugs(records);
    expect(records.map((record) => record.slug)).toEqual([
      "daily-intel-2026-04-19-morning",
      "daily-intel-2026-04-19-morning-2",
    ]);
  });

  it("does not let excluded siblings change an included singleton slug", async () => {
    const { assignDailySlugs } = await import(
      "../../scripts/migrate-articles/audit.mjs"
    );
    const records = [
      {
        postId: "2026-05-06_STN_B_004",
        family: "daily-intel",
        include: true,
        publishedAtJst: "2026-05-06T15:30:00+09:00",
        slug: "pending",
      },
      {
        postId: "2026-05-06_STN_B_001",
        family: "daily-intel",
        include: false,
        publishedAtJst: "2026-05-06T00:00:00+09:00",
        slug: "pending",
      },
    ];
    assignDailySlugs(records);
    expect(records.map((record) => record.slug)).toEqual([
      "daily-intel-2026-05-06",
      "daily-intel-2026-05-06-morning",
    ]);
  });

  it("proposes H2 evidence and the bounded snowflake time basis", () => {
    const result = auditSourceRoot(sourceRoot, { includeArchive: false });
    const headings = result.records.find(
      (record) => record.audit.rawPostId === "2026-06-18_STN_A_001",
    );
    expect(headings.publicH2s).toEqual(["## 1｜公開章"]);
    expect(headings.internalH2s).toEqual(["## 編集メモ"]);
    expect(headings.h2ClassificationBasis).toBe("external_body");
    expect(headings.audit.siblingPaths).toEqual([
      "07_DATA/content/drafts/SITIONjp/2026-06-18_STN_A_001_x_article_body.txt",
    ]);

    const missingUrl = result.records.find(
      (record) => record.postId === "2026-04-26_STN_12IND",
    );
    expect(missingUrl.excludeReason).toBe("log row exists but lacks URL");

    const snowflake = result.records.find(
      (record) => record.postId === "2026-05-23_STN_DD_001",
    );
    expect(snowflake.timeBasis).toBe("snowflake_url");
    expect(snowflake.titleTransform).toBe("strip_prefix");
    expect(snowflake.titleJa).toBe("Warsh と金融政策");
    expect(snowflake.publishedAtJst).toBe(
      "2026-05-23T11:59:00+09:00",
    );
    expect(result.summary.timeBasis).toEqual({
      null: 8,
      snowflake_url: 1,
    });
    expect(result.summary.titleTransform).toEqual({
      strip_prefix: 8,
      verbatim: 1,
    });
    expect(result.summary.unmatchedEvidenceCandidates).toBe(1);
    expect(result.summary.unmatchedEvidencePairs).toBe(1);
    expect(result.report).toContain(
      "2026-06-17_STN_DD_001 <- x_manual_markerless",
    );
  });

  it("recognizes the remaining declared catalog title prefixes", async () => {
    const { titleDeclaration } = await import(
      "../../scripts/migrate-articles/audit.mjs"
    );
    const cases = [
      ["🚨 SCOOP｜上院銀行委員会", "上院銀行委員会"],
      ["🚨 Signal｜Arthur Hayes が発信", "Arthur Hayes が発信"],
      ["週末12指標｜S&P 7,500", "S&P 7,500"],
      ["朝の12指標｜ADA反発", "ADA反発"],
    ];
    for (const [original, expected] of cases) {
      expect(titleDeclaration(original)).toMatchObject({
        titleTransform: "strip_prefix",
        titleJa: expected,
      });
    }
  });
});
