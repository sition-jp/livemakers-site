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
import { escapeMdx, extractBody, publishedLabelFromJst } from "./lib.mjs";
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

export function verifyContentRecords(records, contentDir, maxStage = 2) {
  const expected = records.filter(
    (record) =>
      record.include && record.stage !== null && record.stage <= maxStage,
  );
  const expectedBySlug = new Map(
    expected.map((record) => [record.slug, record]),
  );
  const failures = [];
  if (!fs.existsSync(contentDir)) return [`missing content directory: ${contentDir}`];

  const entries = fs.readdirSync(contentDir, { withFileTypes: true });
  const actualDirs = new Set();
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      failures.push(`stray file in content/articles: ${entry.name}`);
      continue;
    }
    actualDirs.add(entry.name);
    const directory = path.join(contentDir, entry.name);
    const files = fs.readdirSync(directory);
    if (!files.includes("meta.json")) {
      failures.push(`missing meta.json: ${entry.name}`);
    }
    for (const file of files) {
      if (!["meta.json", "ja.md", "en.md"].includes(file)) {
        failures.push(`disallowed file: ${entry.name}/${file}`);
      }
    }
    const jaPath = path.join(directory, "ja.md");
    if (!fs.existsSync(jaPath) || !fs.readFileSync(jaPath, "utf8").trim()) {
      failures.push(`empty or missing ja.md: ${entry.name}`);
    }
  }
  for (const slug of expectedBySlug.keys()) {
    if (!actualDirs.has(slug)) {
      failures.push(`missing (in manifest, not on disk): ${slug}`);
    }
  }
  for (const directory of actualDirs) {
    if (!expectedBySlug.has(directory)) {
      failures.push(`extra (on disk, not in manifest): ${directory}`);
    }
  }

  for (const record of expected) {
    if (!actualDirs.has(record.slug)) continue;
    const directory = path.join(contentDir, record.slug);
    const metaPath = path.join(directory, "meta.json");
    const jaPath = path.join(directory, "ja.md");
    if (!fs.existsSync(metaPath) || !fs.existsSync(jaPath)) continue;
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch (error) {
      failures.push(`invalid meta.json ${record.slug}: ${error.message}`);
      continue;
    }
    const body = fs.readFileSync(jaPath, "utf8");
    if (meta.articleId !== record.slug) failures.push(`META articleId ${record.slug}`);
    if (meta.family !== record.family) failures.push(`META family ${record.slug}`);
    if (meta.titleJa !== record.titleJa) failures.push(`META titleJa ${record.slug}`);
    if (meta.publishedAtJst !== record.publishedAtJst) {
      failures.push(`META publishedAtJst ${record.slug}`);
    }
    if (meta.publishedLabel !== publishedLabelFromJst(record.publishedAtJst)) {
      failures.push(`META publishedLabel ${record.slug}`);
    }
    if ((meta.dataDate ?? null) !== record.dataDate) {
      failures.push(`META dataDate ${record.slug}`);
    }
    if (JSON.stringify(meta.lanes ?? []) !== JSON.stringify(record.lanes)) {
      failures.push(`META lanes ${record.slug}`);
    }
    if ((meta.sourceXUrl ?? null) !== record.sourceXUrl) {
      failures.push(`META sourceXUrl ${record.slug}`);
    }
    if (
      record.titleTransform === "strip_prefix" &&
      record.titlePrefix + record.titleJa !== record.titleOriginal
    ) {
      failures.push(`TITLE concat ${record.slug}`);
    }
    const hits = scanForbidden(body);
    if (hits.length > 0) {
      failures.push(`FORBIDDEN ${record.slug}: ${hits.join(",")}`);
    }
    const h2s = [...body.matchAll(/^## .*$/gm)].map((match) => match[0]);
    const expectedH2s = record.publicH2s.map((heading) => escapeMdx(heading));
    if (JSON.stringify(h2s) !== JSON.stringify(expectedH2s)) {
      failures.push(
        `PUBLIC H2 sequence ${record.slug}: got ${JSON.stringify(h2s)} expected ${JSON.stringify(expectedH2s)}`,
      );
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

  if (process.argv.includes("--against-content")) {
    const stageArg = process.argv.find((argument) =>
      argument.startsWith("--stage="),
    );
    const maxStage = stageArg ? Number(stageArg.slice("--stage=".length)) : 2;
    if (![1, 2].includes(maxStage)) {
      console.error(`invalid stage: ${maxStage}`);
      process.exit(1);
    }
    const contentDir = path.join(process.cwd(), "content", "articles");
    const failures = verifyContentRecords(records, contentDir, maxStage);
    if (failures.length > 0) {
      console.error(`CONTENT GATE FAILED:\n${failures.join("\n")}`);
      process.exit(1);
    }
    console.log(
      `OK: ${records.filter((record) => record.include && record.stage <= maxStage).length} records match content/articles exactly (stage<=${maxStage})`,
    );
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  cli();
}
