import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readSourceText } from "./evidence.mjs";
import {
  applyBodyPatch,
  applyTitleTransform,
  buildMeta,
  escapeMdx,
  extractBody,
  extractH2s,
} from "./lib.mjs";
import { ManifestRecordSchema } from "./manifest.schema.mjs";
import { scanForbidden } from "./scan.mjs";

const sourceRootArg = process.argv.find((argument) =>
  argument.startsWith("--source-root="),
);
const stageArg = process.argv.find((argument) =>
  argument.startsWith("--stage="),
);
if (!sourceRootArg || !stageArg) {
  console.error(
    "usage: convert.mjs --source-root=<sition-core checkout> --stage=<1|2>",
  );
  process.exit(1);
}
const sourceRoot = sourceRootArg.slice("--source-root=".length);
const maxStage = Number(stageArg.slice("--stage=".length));
if (![1, 2].includes(maxStage)) {
  throw new Error(`invalid stage: ${maxStage}`);
}

const manifestPath = path.join(
  process.cwd(),
  "scripts/migrate-articles/manifest/stn-migration.v1.json",
);
const records = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  .map((record) => ManifestRecordSchema.parse(record))
  .filter(
    (record) => record.include && record.stage !== null && record.stage <= maxStage,
  );

function readSource(record, relativePath, expectedSha) {
  const raw = readSourceText(sourceRoot, record.sourceRef, relativePath);
  const actualSha = crypto
    .createHash("sha256")
    .update(raw, "utf8")
    .digest("hex");
  if (actualSha !== expectedSha) {
    throw new Error(
      `SOURCE DRIFT ${record.postId} ${relativePath}: sha256 mismatch`,
    );
  }
  return raw;
}

const contentDir = path.join(process.cwd(), "content", "articles");
let written = 0;
for (const record of records) {
  const raw = readSource(record, record.sourcePath, record.sourceSha256);
  applyTitleTransform(record);
  let bodySource = raw;
  let declaration = record;
  if (record.bodySelector === "external_file") {
    bodySource = readSource(
      record,
      record.bodySourcePath,
      record.bodySourceSha256,
    );
    declaration = { ...record, bodySelector: "full_after_frontmatter" };
  }
  const rawBody = extractBody(bodySource, declaration);
  const rawHits = scanForbidden(rawBody).toSorted();
  const declaredHits = [...record.forbiddenTermHits].toSorted();
  if (JSON.stringify(rawHits) !== JSON.stringify(declaredHits)) {
    throw new Error(
      `FORBIDDEN HIT DECLARATION MISMATCH ${record.postId}: recomputed=[${rawHits}] declared=[${declaredHits}]`,
    );
  }
  const body = escapeMdx(applyBodyPatch(rawBody, record.bodyPatch));
  if (!body) throw new Error(`EMPTY BODY ${record.postId}`);
  const hits = scanForbidden(body);
  if (hits.length > 0) {
    throw new Error(
      `FORBIDDEN TERMS after patch in ${record.postId}: ${hits.join(", ")}`,
    );
  }
  const expectedH2s = record.publicH2s.map((heading) => escapeMdx(heading));
  if (JSON.stringify(extractH2s(body)) !== JSON.stringify(expectedH2s)) {
    throw new Error(`PUBLIC H2 MISMATCH ${record.postId}`);
  }
  const directory = path.join(contentDir, record.slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "meta.json"),
    `${JSON.stringify(buildMeta(record), null, 2)}\n`,
  );
  fs.writeFileSync(path.join(directory, "ja.md"), `${body}\n`);
  written += 1;
}

console.log(`converted ${written} articles (stage<=${maxStage})`);
