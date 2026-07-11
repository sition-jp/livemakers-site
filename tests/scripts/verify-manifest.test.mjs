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
});
