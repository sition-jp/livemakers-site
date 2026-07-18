import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditSourceRoot } from "./audit.mjs";
import { validateManifest } from "./manifest.schema.mjs";

// P0-4 WS-LiveMakers interim batch (P2-SDE-OUT-G1, charter §4-4).
// Re-runs the G42 audit over the full corpus, keeps only records that are
// (a) not already adjudicated in the existing manifest and (b) X-published
// inside the declared interim window, then appends them to the manifest
// byte-preserving the existing records.

export function splitInterimDelta(
  auditRecords,
  existingPostIds,
  windowStartJst,
  cutoffJst,
) {
  const existing = [];
  const delta = [];
  const outOfWindow = [];
  for (const record of auditRecords) {
    if (existingPostIds.has(record.postId)) {
      existing.push(record);
      continue;
    }
    const at = record.publishedAtJst ?? "";
    if (at > windowStartJst && at <= cutoffJst) {
      delta.push(record);
    } else {
      outOfWindow.push(record);
    }
  }
  const byTime = (left, right) =>
    `${left.publishedAtJst}${left.postId}`.localeCompare(
      `${right.publishedAtJst}${right.postId}`,
    );
  delta.sort(byTime);
  outOfWindow.sort(byTime);
  return { delta, outOfWindow, existing };
}

export function mergeManifestText(baseText, delta) {
  const base = JSON.parse(baseText);
  const seen = new Set(base.map((record) => record.postId));
  for (const record of delta) {
    if (seen.has(record.postId)) {
      throw new Error(`delta postId already exists in base: ${record.postId}`);
    }
    seen.add(record.postId);
  }
  const clean = delta.map(({ audit, ...rest }) => rest);
  const closer = baseText.lastIndexOf("\n]");
  if (closer === -1) {
    throw new Error("base manifest text does not end with a JSON array");
  }
  const prefix = baseText.slice(0, closer);
  const items = JSON.stringify(clean, null, 2)
    .replace(/^\[\n/, "")
    .replace(/\n\]$/, "");
  return `${prefix},\n${items}\n]\n`;
}

// Editorial lane assignment for the interim delta (reviewed in the batch PR).
// Calibrated against the G42 manifest precedent: 規制当局・金利・マクロ市場・
// AI 産業 = macro / 暗号資産法制・チェーン・stablecoin = crypto / トークン化
// 株式・RWA = rwa。future-map は独立面のため lane 無所属。
export const INTERIM_LANES = {
  "2026-07-13_STN_A_001": ["crypto"],
  "2026-07-13_STN_A_002": ["macro"],
  "2026-07-13_STN_A_003": ["macro"],
  "2026-07-14_STN_A_001": ["rwa"],
  "2026-07-16_STN_DD_001": ["crypto"],
  "2026-07-16_STN_A_001": ["rwa"],
  "2026-07-16_STN_A_002": ["crypto"],
  "2026-07-16_STN_DD_002": ["macro"],
  "2026-07-16_STN_A_003": ["crypto"],
  "2026-07-16_STN_A_004": ["macro"],
  "2026-07-16_STN_A_005": ["macro"],
  "2026-07-17_STN_DD_001": ["crypto"],
  "2026-07-17_STN_A_001": ["macro"],
  "2026-07-17_STN_A_002": ["macro"],
  "2026-07-17_STN_A_003": ["crypto"],
  "2026-07-11_STN_ARTICLE_009": [],
  "2026-07-18_STN_ARTICLE_010": [],
};

export function applyInterimLanes(delta, assignments = INTERIM_LANES) {
  for (const record of delta) {
    const assigned = assignments[record.postId];
    if (assigned !== undefined) {
      record.lanes = assigned;
      continue;
    }
    if (
      record.include &&
      ["signal", "deep-dive", "future-map"].includes(record.family)
    ) {
      throw new Error(
        `no lane assignment for included ${record.family} record ${record.postId}`,
      );
    }
  }
  return delta;
}

function renderInterimReport(context) {
  const {
    windowStartJst,
    cutoffJst,
    delta,
    outOfWindow,
    existingCount,
    summaryRaw,
    manifestSha256,
  } = context;
  const included = delta.filter((record) => record.include);
  const excluded = delta.filter((record) => !record.include);
  const countBy = (records, key) =>
    Object.fromEntries(
      [...new Set(records.map((record) => record[key]))]
        .sort()
        .map((value) => [
          value,
          records.filter((record) => record[key] === value).length,
        ]),
    );
  return [
    "# P0-4 WS-LiveMakers interim batch — audit report (P2-SDE-OUT-G1)",
    "",
    `- Interim window (JST): (${windowStartJst}, ${cutoffJst}]`,
    `- Existing manifest records re-confirmed by audit: ${existingCount}`,
    `- Window population (delta records appended): ${delta.length}`,
    `- Included: ${included.length}`,
    `- Excluded: ${excluded.length}`,
    `- Families (delta): ${JSON.stringify(countBy(delta, "family"))}`,
    `- Evidence kinds (included): ${JSON.stringify(countBy(included, "evidenceKind"))}`,
    `- Raw population scanned: ${JSON.stringify(summaryRaw)}`,
    `- Merged manifest sha256: ${manifestSha256}`,
    "",
    "## Delta records",
    "",
    ...delta.map(
      (record) =>
        `- ${record.postId} | ${record.publishedAtJst} | ${record.family} | ${
          record.include ? `include (${record.evidenceKind})` : `EXCLUDE: ${record.excludeReason}`
        } | ${record.slug} | ${record.sourceXUrl ?? "-"}`,
    ),
    "",
    "## Out-of-window audit candidates (not appended)",
    "",
    ...(outOfWindow.length > 0
      ? outOfWindow.map(
          (record) =>
            `- ${record.postId} | ${record.publishedAtJst} | ${record.excludeReason ?? "included-by-audit but outside window"}`,
        )
      : ["- none"]),
    "",
  ].join("\n");
}

function cli() {
  const arg = (name) =>
    process.argv
      .find((argument) => argument.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const sourceRoot = arg("source-root");
  const windowStartJst = arg("window-start");
  const cutoffJst = arg("cutoff");
  const reportPath = arg("report");
  if (!sourceRoot || !windowStartJst || !cutoffJst || !reportPath) {
    console.error(
      "usage: interim-merge.mjs --source-root=<sition-core> --window-start=<jst iso> --cutoff=<jst iso> --report=<md>",
    );
    process.exit(1);
  }

  const manifestPath = path.join(
    process.cwd(),
    "scripts/migrate-articles/manifest/stn-migration.v1.json",
  );
  const baseText = fs.readFileSync(manifestPath, "utf8");
  const base = JSON.parse(baseText);
  const existingPostIds = new Set(base.map((record) => record.postId));

  const audit = auditSourceRoot(sourceRoot);
  const { delta, outOfWindow, existing } = splitInterimDelta(
    audit.records,
    existingPostIds,
    windowStartJst,
    cutoffJst,
  );
  applyInterimLanes(delta);

  const merged = mergeManifestText(baseText, delta);
  const validation = validateManifest(JSON.parse(merged));
  if (!validation.ok) {
    console.error(`MERGED MANIFEST INVALID:\n${validation.errors.join("\n")}`);
    process.exit(1);
  }
  fs.writeFileSync(manifestPath, merged);
  const manifestSha256 = crypto
    .createHash("sha256")
    .update(merged, "utf8")
    .digest("hex");

  const report = renderInterimReport({
    windowStartJst,
    cutoffJst,
    delta,
    outOfWindow,
    existingCount: existing.length,
    summaryRaw: audit.summary.raw,
    manifestSha256,
  });
  fs.writeFileSync(reportPath, report);
  console.log(
    JSON.stringify(
      {
        existing: existing.length,
        delta: delta.length,
        included: delta.filter((record) => record.include).length,
        excluded: delta.filter((record) => !record.include).length,
        outOfWindow: outOfWindow.length,
        manifestSha256,
      },
      null,
      2,
    ),
  );
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  cli();
}
