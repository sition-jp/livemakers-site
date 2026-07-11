import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkConflict,
  checkLogEvidence,
  checkPrimaryEvidence,
  loadPublishedLog,
  parseFrontmatter,
  readSourceText,
} from "./evidence.mjs";
import { extractBody } from "./lib.mjs";
import { validateManifest } from "./manifest.schema.mjs";
import { scanForbidden } from "./scan.mjs";

const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

export function verifySourceRecords(records, sourceRoot) {
  const logIndex = loadPublishedLog(sourceRoot);
  const failures = [];
  for (const record of records) {
    const fail = (reason) => failures.push(`${record.postId}: ${reason}`);
    let raw;
    try {
      raw = readSourceText(
        sourceRoot,
        record.sourceRef,
        record.sourcePath,
      );
    } catch (error) {
      fail(`source unreadable: ${error.message}`);
      continue;
    }
    if (sha256(raw) !== record.sourceSha256) {
      fail("sourceSha256 drift");
    }

    const frontmatter = parseFrontmatter(raw);
    if (record.include) {
      const sourceFileDate =
        record.sourcePath.match(/(\d{4}-\d{2}-\d{2})_/)?.[1] ??
        record.publishedAtJst.slice(0, 10);
      if (record.evidenceKind === "log_verified") {
        for (const reason of checkLogEvidence(
          record,
          logIndex,
          sourceFileDate,
        )) {
          fail(reason);
        }
      } else {
        let primaryFrontmatter = frontmatter;
        if (record.evidenceKind === "archive") {
          try {
            primaryFrontmatter = parseFrontmatter(
              readSourceText(
                sourceRoot,
                `content-archive:${record.archiveCommit}`,
                record.sourcePath,
              ),
            );
          } catch (error) {
            fail(`archive source unreadable: ${error.message}`);
            primaryFrontmatter = null;
          }
        }
        if (primaryFrontmatter) {
          for (const reason of checkPrimaryEvidence(
            record,
            primaryFrontmatter,
          )) {
            fail(reason);
          }
        }
      }
      for (const reason of checkConflict(
        frontmatter,
        logIndex,
        record.postId,
      )) {
        fail(reason);
      }
    }

    let bodySource = raw;
    let declaration = record;
    if (record.bodySelector === "external_file") {
      try {
        bodySource = readSourceText(
          sourceRoot,
          record.sourceRef,
          record.bodySourcePath,
        );
      } catch (error) {
        fail(`body source unreadable: ${error.message}`);
        continue;
      }
      if (sha256(bodySource) !== record.bodySourceSha256) {
        fail("bodySourceSha256 drift");
      }
      declaration = { ...record, bodySelector: "full_after_frontmatter" };
    }
    try {
      const rawBody = extractBody(bodySource, declaration);
      const rawHits = scanForbidden(rawBody).toSorted();
      const declaredHits = [...record.forbiddenTermHits].toSorted();
      if (JSON.stringify(rawHits) !== JSON.stringify(declaredHits)) {
        fail(
          `forbidden hits recomputed=[${rawHits}] declared=[${declaredHits}]`,
        );
      }
    } catch (error) {
      fail(`body contract: ${error.message}`);
    }
  }
  return failures;
}

function cli() {
  const manifestPath = path.join(
    process.cwd(),
    "scripts/migrate-articles/manifest/stn-migration.v1.json",
  );
  const records = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const result = validateManifest(records);
  if (!result.ok) {
    console.error(`MANIFEST INVALID:\n${result.errors.join("\n")}`);
    process.exit(1);
  }
  console.log(
    `OK: manifest valid (${records.length} records, ${
      records.filter((record) => record.include).length
    } included)`,
  );

  const sourceRootArg = process.argv.find((argument) =>
    argument.startsWith("--source-root="),
  );
  if (sourceRootArg) {
    const sourceRoot = sourceRootArg.slice("--source-root=".length);
    const failures = verifySourceRecords(records, sourceRoot);
    if (failures.length > 0) {
      console.error(`EVIDENCE GATE FAILED:\n${failures.join("\n")}`);
      process.exit(1);
    }
    console.log(
      `OK: source/body recomputation passed for ${records.length} records; evidence passed for ${
        records.filter((record) => record.include).length
      } included records`,
    );
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  cli();
}
