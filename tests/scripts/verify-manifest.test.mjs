import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { auditSourceRoot } from "../../scripts/migrate-articles/audit.mjs";

const sourceRoot = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "audit-sources",
);

describe("verify-manifest source recomputation", () => {
  it("re-reads evidence, hashes, body boundaries, H2s, and forbidden hits", async () => {
    const { verifySourceRecords } = await import(
      "../../scripts/migrate-articles/verify-manifest.mjs"
    );
    const audited = auditSourceRoot(sourceRoot, { includeArchive: false });
    const records = audited.records.filter((record) => record.include);
    expect(verifySourceRecords(records, sourceRoot)).toEqual([]);

    const tampered = records.map((record, index) =>
      index === 0 ? { ...record, sourceSha256: "0".repeat(64) } : record,
    );
    expect(verifySourceRecords(tampered, sourceRoot).join("\n")).toMatch(
      /sourceSha256 drift/,
    );

    const h2Record = records.find((record) => record.publicH2s.length > 0);
    const excludedWithUncoveredH2 = {
      ...h2Record,
      include: false,
      stage: null,
      excludeReason: "test exclusion",
      publicH2s: [],
      internalH2s: [],
    };
    expect(
      verifySourceRecords([excludedWithUncoveredH2], sourceRoot).join("\n"),
    ).toMatch(/uncovered H2/);
  });

  it("checks generated content structure, metadata, body, and public H2s", async () => {
    const { verifyContentRecords } = await import(
      "../../scripts/migrate-articles/verify-manifest.mjs"
    );
    const contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "g42-content-"));
    const record = {
      include: true,
      stage: 1,
      slug: "signal-test-2026-07-10",
      family: "signal",
      titleJa: "テスト",
      titleOriginal: "📡 Signal｜テスト",
      titleTransform: "strip_prefix",
      titlePrefix: "📡 Signal｜",
      publishedAtJst: "2026-07-10T10:00:00+09:00",
      dataDate: null,
      lanes: ["macro"],
      sourceXUrl: "https://x.com/SITIONjp/status/1",
      publicH2s: ["## 公開章"],
    };
    const articleDir = path.join(contentDir, record.slug);
    fs.mkdirSync(articleDir);
    fs.writeFileSync(
      path.join(articleDir, "meta.json"),
      `${JSON.stringify({
        articleId: record.slug,
        family: record.family,
        titleJa: record.titleJa,
        publishedAtJst: record.publishedAtJst,
        publishedLabel: "07-10 10:00 公開",
        lanes: record.lanes,
        sourceXUrl: record.sourceXUrl,
      })}\n`,
    );
    fs.writeFileSync(path.join(articleDir, "ja.md"), "本文\n\n## 公開章\n章。\n");
    expect(verifyContentRecords([record], contentDir, 1)).toEqual([]);
    fs.writeFileSync(path.join(contentDir, "stray.txt"), "stray");
    expect(verifyContentRecords([record], contentDir, 1).join("\n")).toMatch(
      /stray file/,
    );
  });
});
