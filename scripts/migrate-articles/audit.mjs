import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  checkConflict,
  checkLogEvidence,
  checkPrimaryEvidence,
  hoursBetween,
  loadPublishedLog,
  normalizeTitle,
  parseFrontmatter,
  readSourceText,
  snowflakeJstIso,
  utcToJstIso,
} from "./evidence.mjs";
import { scanForbidden } from "./scan.mjs";

const MAIN_ROOT = "07_DATA/content/drafts/SITIONjp";
const DOCS_ROOT = "08_DOCS/drafts";
const STAGE1_FROM = "2026-06-11";
const INTERNAL_H2 =
  /(?:サムネ|編集メモ|Canva|Midjourney|短縮投稿用|公開後|ファクトチェック|クロスポスト|内部メモ|画像生成|Thumbnail|関連(?:記事|投稿))/i;

const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function frontmatterValue(markdown, key) {
  const block = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return null;
  const match = block[1].match(
    new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"),
  );
  return match ? match[1].trim() : null;
}

function sourceDate(candidate) {
  return (
    candidate.sourcePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ??
    "1970-01-01"
  );
}

function titleFrom(candidate) {
  const frontmatterTitle = candidate.frontmatter.title;
  if (frontmatterTitle) return frontmatterTitle;
  const heading = candidate.text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const withoutFrontmatter = candidate.text
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("## "));
  return withoutFrontmatter || path.basename(candidate.sourcePath, ".md");
}

function familyFrom(candidate) {
  const id = candidate.rawPostId;
  const type = frontmatterValue(candidate.text, "type") ?? "";
  if (/_STN_(?:B|DI)_/.test(id)) {
    return "daily-intel";
  }
  if (/_STN_A_/.test(id)) {
    return "signal";
  }
  if (/_STN_(?:DD|SDE)_/.test(id)) {
    return "deep-dive";
  }
  if (/_STN_RDR_/.test(id)) {
    return "event-risk-radar";
  }
  if (/_STN_(?:MKT|12IND)/i.test(id)) {
    return /weekend|週末|12IND/i.test(
      `${candidate.sourcePath}\n${titleFrom(candidate)}`,
    )
      ? "mkt12-weekend"
      : "mkt12-morning";
  }
  if (/Daily Intel/i.test(type)) return "daily-intel";
  if (/Deep Dive/i.test(type)) return "deep-dive";
  if (/Event Risk Radar/i.test(type)) return "event-risk-radar";
  if (/12indicators/i.test(type)) return "mkt12-morning";
  return "signal";
}

function manifestStem(candidate) {
  return path.basename(candidate.sourcePath, ".md");
}

function candidateFromText(sourceRoot, sourceRef, sourcePath, text) {
  const frontmatter = parseFrontmatter(text);
  return {
    sourceRoot,
    sourceRef,
    sourcePath,
    text,
    frontmatter,
    rawPostId: frontmatter.postId ?? manifestStem({ sourcePath }),
  };
}

function collectWorktreeCandidates(sourceRoot) {
  const main = walkFiles(path.join(sourceRoot, MAIN_ROOT))
    .filter(
      (file) =>
        file.endsWith(".md") &&
        !/(?:_mj)?_thumbnail_prompts\.md$/.test(file) &&
        !/_review_notes\.md$/.test(file),
    )
    .map((file) => {
      const sourcePath = path.relative(sourceRoot, file);
      return candidateFromText(
        sourceRoot,
        "worktree",
        sourcePath,
        fs.readFileSync(file, "utf8"),
      );
    });
  const docs = walkFiles(path.join(sourceRoot, DOCS_ROOT))
    .filter(
      (file) =>
        file.endsWith(".md") &&
        !/(?:_mj)?_thumbnail_prompts\.md$/.test(file) &&
        !/_review_notes\.md$/.test(file),
    )
    .map((file) => {
      const sourcePath = path.relative(sourceRoot, file);
      return candidateFromText(
        sourceRoot,
        "worktree",
        sourcePath,
        fs.readFileSync(file, "utf8"),
      );
    })
    .filter(
      (candidate) =>
        frontmatterValue(candidate.text, "account") === "SITIONjp" ||
        /(?:^|_)STN(?:_|-)/.test(path.basename(candidate.sourcePath)),
    );
  return { main, docs };
}

function collectArchiveCandidates(sourceRoot) {
  let commit;
  try {
    commit = execFileSync(
      "git",
      ["-C", sourceRoot, "rev-parse", "content-archive"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return { commit: null, candidates: [] };
  }
  const paths = execFileSync(
    "git",
    [
      "-C",
      sourceRoot,
      "ls-tree",
      "-r",
      "--name-only",
      commit,
      "--",
      DOCS_ROOT,
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((sourcePath) => sourcePath.endsWith(".md"));
  const candidates = paths
    .map((sourcePath) =>
      candidateFromText(
        sourceRoot,
        `content-archive:${commit}`,
        sourcePath,
        readSourceText(sourceRoot, `content-archive:${commit}`, sourcePath),
      ),
    )
    .filter(
      (candidate) =>
        frontmatterValue(candidate.text, "account") === "SITIONjp" ||
        /(?:^|_)STN(?:_|-)/.test(path.basename(candidate.sourcePath)),
    );
  return { commit, candidates };
}

function selectLogicalCandidates(candidates) {
  const byRawPostId = new Map();
  for (const candidate of candidates) {
    byRawPostId.set(candidate.rawPostId, [
      ...(byRawPostId.get(candidate.rawPostId) ?? []),
      candidate,
    ]);
  }

  const score = (candidate) => {
    if (candidate.sourcePath.startsWith(`${MAIN_ROOT}/`)) return 4;
    if (candidate.sourceRef.startsWith("content-archive:")) return 3;
    if (candidate.sourcePath.startsWith(`${DOCS_ROOT}/`)) return 2;
    return 1;
  };

  const selected = [];
  for (const [rawPostId, locations] of byRawPostId) {
    const mainTitles = new Set(
      locations
        .filter((candidate) =>
          candidate.sourcePath.startsWith(`${MAIN_ROOT}/`),
        )
        .map((candidate) => normalizeTitle(titleFrom(candidate))),
    );
    const collision = mainTitles.size > 1;
    const groups = new Map();
    for (const candidate of locations) {
      const key = collision
        ? normalizeTitle(titleFrom(candidate))
        : rawPostId;
      groups.set(key, [...(groups.get(key) ?? []), candidate]);
    }
    for (const [logicalKey, group] of groups) {
      const chosen = [...group].sort(
        (left, right) => score(right) - score(left),
      )[0];
      selected.push({
        ...chosen,
        manifestPostId: collision ? manifestStem(chosen) : rawPostId,
        collision,
        sourceLocations: group.map(
          (location) => `${location.sourceRef}:${location.sourcePath}`,
        ),
        logicalKey: `${rawPostId}::${logicalKey}`,
      });
    }
  }
  return selected;
}

export function titleDeclaration(titleOriginal) {
  const patterns = [
    /^(?:📋\s*)?Daily Intel[^｜]*｜/,
    /^📡\s*Signal[^｜]*｜/,
    /^🚨\s*Signal｜/,
    /^🚨\s*SCOOP｜/,
    /^[🔍🔬]\s*Deep Dive[^｜]*｜/u,
    /^📊\s*SITION 12指標 日次レポート[^｜]*｜/,
    /^(?:週末12指標|朝の12指標)｜/,
    /^📌\s*Event Risk Radar[^｜]*｜/,
  ];
  const prefix = patterns
    .map((pattern) => titleOriginal.match(pattern)?.[0] ?? null)
    .find(Boolean);
  return prefix
    ? {
        titleTransform: "strip_prefix",
        titlePrefix: prefix,
        titleJa: titleOriginal.slice(prefix.length),
      }
    : { titleTransform: "verbatim", titlePrefix: null, titleJa: titleOriginal };
}

function siblingTextPaths(sourceRoot, candidate) {
  const stemPrefix = candidate.rawPostId;
  return [MAIN_ROOT, DOCS_ROOT].flatMap((root) => {
    const directory = path.join(sourceRoot, root);
    if (!fs.existsSync(directory)) return [];
    return fs
      .readdirSync(directory)
      .filter(
        (name) =>
          name.startsWith(stemPrefix) &&
          /_x_(?:paste|article)_body\.txt$/.test(name),
      )
      .map((name) => path.join(root, name));
  });
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function selectBodyText(text, selector) {
  const withoutFrontmatter = stripFrontmatter(text);
  const patterns = {
    exact_marker: /^## 投稿本文\s*$/m,
    decorated_marker: /^## 投稿本文（[^）]*）\s*$/m,
    xcopy_marker: /^## Xコピペ形式（投稿本文）\s*$/m,
  };
  const pattern = patterns[selector];
  if (!pattern) return withoutFrontmatter.trim();
  const match = withoutFrontmatter.match(pattern);
  if (!match) return withoutFrontmatter.trim();
  return withoutFrontmatter.slice(match.index + match[0].length).trim();
}

function bodyDeclaration(sourceRoot, candidate, family) {
  const siblings = siblingTextPaths(sourceRoot, candidate);
  const sourceWithoutFrontmatter = stripFrontmatter(candidate.text);
  const hasDeclaredMarker =
    /^## 投稿本文\s*$/m.test(sourceWithoutFrontmatter) ||
    /^## 投稿本文（[^）]*）\s*$/m.test(sourceWithoutFrontmatter) ||
    /^## Xコピペ形式（投稿本文）\s*$/m.test(sourceWithoutFrontmatter);
  const externalPath =
    family === "mkt12-weekend" && !hasDeclaredMarker
      ? siblings.find((sibling) => sibling.endsWith("_x_paste_body.txt"))
      : null;
  let bodySelector;
  let selectedText;
  let bodySourcePath = null;
  let bodySourceSha256 = null;
  if (externalPath) {
    bodySelector = "external_file";
    selectedText = fs.readFileSync(path.join(sourceRoot, externalPath), "utf8");
    bodySourcePath = externalPath;
    bodySourceSha256 = sha256(selectedText);
    selectedText = stripFrontmatter(selectedText).trim();
  } else if (/^## 投稿本文\s*$/m.test(stripFrontmatter(candidate.text))) {
    bodySelector = "exact_marker";
    selectedText = selectBodyText(candidate.text, bodySelector);
  } else if (
    /^## 投稿本文（[^）]*）\s*$/m.test(stripFrontmatter(candidate.text))
  ) {
    bodySelector = "decorated_marker";
    selectedText = selectBodyText(candidate.text, bodySelector);
  } else if (
    /^## Xコピペ形式（投稿本文）\s*$/m.test(
      stripFrontmatter(candidate.text),
    )
  ) {
    bodySelector = "xcopy_marker";
    selectedText = selectBodyText(candidate.text, bodySelector);
  } else {
    bodySelector = "full_after_frontmatter";
    selectedText = stripFrontmatter(candidate.text).trim();
  }

  const h2s = [...selectedText.matchAll(/^## .*$/gm)].map((match) =>
    match[0].trim(),
  );
  const siblingTexts = siblings.map((sibling) =>
    fs.readFileSync(path.join(sourceRoot, sibling), "utf8"),
  );
  const publicH2s = [];
  const internalH2s = [];
  const unresolvedH2s = [];
  for (const heading of h2s) {
    if (siblingTexts.length > 0) {
      if (
        siblingTexts.some((text) =>
          text.split("\n").some((line) => line.trim() === heading),
        )
      ) {
        publicH2s.push(heading);
      } else {
        internalH2s.push(heading);
      }
    } else if (INTERNAL_H2.test(heading)) {
      internalH2s.push(heading);
    } else {
      unresolvedH2s.push(heading);
    }
  }
  const h2ClassificationBasis =
    h2s.length === 0
      ? null
      : siblingTexts.length > 0
        ? "external_body"
        : unresolvedH2s.length === 0
          ? "po_parser_boundary"
          : null;

  let publicationText = selectedText;
  const internalIndexes = internalH2s
    .map((heading) => publicationText.indexOf(heading))
    .filter((index) => index >= 0);
  if (internalIndexes.length > 0) {
    publicationText = publicationText.slice(0, Math.min(...internalIndexes));
  }
  let lines = publicationText.split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const titleOriginal = titleFrom(candidate);
  const leadDuplicateLine =
    lines[0]?.trim() === titleOriginal ? lines[0].trim() : null;
  if (leadDuplicateLine) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const trailingHashtagLine = /^#\S/.test(lines.at(-1)?.trim() ?? "")
    ? lines.at(-1).trim()
    : null;
  if (trailingHashtagLine) lines.pop();
  const forbiddenTermHits = scanForbidden(lines.join("\n").trim());

  return {
    bodySelector,
    bodySourcePath,
    bodySourceSha256,
    publicH2s,
    internalH2s,
    unresolvedH2s,
    h2ClassificationBasis,
    leadDuplicateLine,
    trailingHashtagLine,
    forbiddenTermHits,
    siblingPaths: siblings,
  };
}

function normalizePrimaryTime(frontmatter, sourceXUrl) {
  if (!frontmatter.publishedAt) return null;
  const fullIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(
    frontmatter.publishedAt,
  );
  if (!fullIso) {
    const snowflake = snowflakeJstIso(sourceXUrl);
    return snowflake
      ? { publishedAtJst: snowflake, timeBasis: "snowflake_url" }
      : null;
  }
  const jst = /\+09:00$/.test(frontmatter.publishedAt)
    ? `${frontmatter.publishedAt.slice(0, 16)}:00+09:00`
    : utcToJstIso(frontmatter.publishedAt);
  return jst ? { publishedAtJst: jst, timeBasis: null } : null;
}

function matchingLogRow(logIndex, candidate) {
  const rows = (logIndex.get(candidate.manifestPostId) ?? []).filter(
    (row) => row.account === "SITIONjp" && row.status === "published",
  );
  if (rows.length === 0) return null;
  const title = titleFrom(candidate);
  return (
    rows.find((row) => row.title === title) ??
    rows.find((row) => normalizeTitle(row.title) === normalizeTitle(title)) ??
    (candidate.collision ? null : rows.at(-1))
  );
}

function evidenceDeclaration(candidate, logIndex, archiveCommit) {
  const frontmatter = candidate.frontmatter;
  const primaryUrl = frontmatter.publishedUrl;
  const primaryTime = normalizePrimaryTime(frontmatter, primaryUrl);
  const isPublished = ["published", "posted"].includes(
    frontmatter.status ?? "",
  );
  if (isPublished && primaryUrl && primaryTime) {
    return {
      include: true,
      excludeReason: null,
      evidenceKind: candidate.sourceRef.startsWith("content-archive:")
        ? "archive"
        : "frontmatter",
      primaryUrl,
      archiveCommit: candidate.sourceRef.startsWith("content-archive:")
        ? archiveCommit
        : null,
      sourceXUrl: primaryUrl,
      ...primaryTime,
      logId: null,
      logUrl: null,
      logPublishedAtUtc: null,
      logTitle: null,
      titleMatch: null,
    };
  }

  const row = matchingLogRow(logIndex, candidate);
  if (row) {
    const publishedAtJst = utcToJstIso(row.published_at);
    const titleMatch =
      row.title === titleFrom(candidate)
        ? "exact"
        : normalizeTitle(row.title) === normalizeTitle(titleFrom(candidate))
          ? "normalized"
          : "manual";
    if (publishedAtJst && /^https:\/\/x\.com\/SITIONjp\/status\/\d+$/.test(row.url)) {
      return {
        include: true,
        excludeReason: null,
        evidenceKind: "log_verified",
        primaryUrl: null,
        archiveCommit: null,
        sourceXUrl: row.url,
        publishedAtJst,
        timeBasis: null,
        logId: row.id ?? row.article_id,
        logUrl: row.url,
        logPublishedAtUtc: row.published_at,
        logTitle: row.title,
        titleMatch,
      };
    }
  }

  return {
    include: false,
    excludeReason: candidate.collision
      ? "postId collision unresolved"
      : "no publish evidence",
    evidenceKind: "log_verified",
    primaryUrl: null,
    archiveCommit: null,
    sourceXUrl: null,
    publishedAtJst: `${sourceDate(candidate)}T00:00:00+09:00`,
    timeBasis: null,
    logId: null,
    logUrl: null,
    logPublishedAtUtc: null,
    logTitle: null,
    titleMatch: null,
  };
}

function topicFromPath(candidate) {
  const stem = manifestStem(candidate)
    .replace(/^\d{4}-\d{2}-\d{2}_STN_(?:A|DD|SDE)_(?:\d{3}_)?/i, "")
    .replace(/^(?:signal|deep-dive)-/i, "")
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return stem || "untitled";
}

function isoWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86_400_000 + 1) / 7);
}

function initialSlug(record, candidate) {
  const date = record.publishedAtJst.slice(0, 10);
  if (record.family === "daily-intel") return `daily-intel-${date}`;
  if (record.family === "signal") {
    return `signal-${topicFromPath(candidate)}-${date}`;
  }
  if (record.family === "deep-dive") {
    return `deep-dive-${topicFromPath(candidate)}`;
  }
  if (record.family === "mkt12-morning") {
    return `mkt12-morning-${sourceDate(candidate)}`;
  }
  if (record.family === "mkt12-weekend") {
    return `mkt12-weekend-${sourceDate(candidate)}`;
  }
  return `event-risk-radar-w${isoWeek(sourceDate(candidate))}`;
}

function assignDailySlugs(records) {
  const byDate = new Map();
  for (const record of records.filter(
    (item) => item.include && item.family === "daily-intel",
  )) {
    const date = record.publishedAtJst.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), record]);
  }
  const slotFor = (hhmm) =>
    hhmm < "11:00"
      ? "morning"
      : hhmm < "17:00"
        ? "midday"
        : hhmm < "21:00"
          ? "evening"
          : "night";
  for (const [date, group] of byDate) {
    if (group.length === 1) {
      group[0].slug = `daily-intel-${date}`;
      continue;
    }
    const counts = new Map();
    for (const record of group.toSorted((left, right) =>
      `${left.publishedAtJst}${left.postId}`.localeCompare(
        `${right.publishedAtJst}${right.postId}`,
      ),
    )) {
      const slot = slotFor(record.publishedAtJst.slice(11, 16));
      const count = (counts.get(slot) ?? 0) + 1;
      counts.set(slot, count);
      record.slug = `daily-intel-${date}-${slot}${
        count > 1 ? `-${count}` : ""
      }`;
    }
  }
}

function buildRecord(sourceRoot, candidate, logIndex, archiveCommit) {
  const family = familyFrom(candidate);
  const titleOriginal = titleFrom(candidate);
  const title = titleDeclaration(titleOriginal);
  const evidence = evidenceDeclaration(candidate, logIndex, archiveCommit);
  const body = bodyDeclaration(sourceRoot, candidate, family);
  let include = evidence.include;
  let excludeReason = evidence.excludeReason;
  if (include && body.forbiddenTermHits.length > 0) {
    include = false;
    excludeReason = `forbidden terms require remediation: ${body.forbiddenTermHits.join(", ")}`;
  }
  const dataDate =
    family === "mkt12-morning" || family === "mkt12-weekend"
      ? sourceDate(candidate)
      : null;
  const record = {
    postId: candidate.manifestPostId,
    sourcePath: candidate.sourcePath,
    sourceRef: candidate.sourceRef,
    sourceSha256: sha256(candidate.text),
    family,
    slug: "pending",
    titleJa: title.titleJa,
    titleOriginal,
    titleTransform: title.titleTransform,
    titlePrefix: title.titlePrefix,
    publishedAtJst: evidence.publishedAtJst,
    dataDate,
    lanes: family === "event-risk-radar" ? ["macro"] : [],
    sourceXUrl: evidence.sourceXUrl,
    evidenceKind: evidence.evidenceKind,
    primaryUrl: evidence.primaryUrl,
    archiveCommit: evidence.archiveCommit,
    logId: evidence.logId,
    logUrl: evidence.logUrl,
    logPublishedAtUtc: evidence.logPublishedAtUtc,
    logTitle: evidence.logTitle,
    titleMatch: evidence.titleMatch,
    bodySelector: body.bodySelector,
    bodySourcePath: body.bodySourcePath,
    bodySourceSha256: body.bodySourceSha256,
    publicH2s: body.publicH2s,
    internalH2s: body.internalH2s,
    h2ClassificationBasis: body.h2ClassificationBasis,
    leadDuplicateLine: body.leadDuplicateLine,
    trailingHashtagLine: body.trailingHashtagLine,
    manualReviewedBy: null,
    manualReviewReason: null,
    timeBasis: evidence.timeBasis,
    forbiddenTermHits: body.forbiddenTermHits,
    bodyPatch: null,
    include,
    excludeReason,
    stage:
      include && evidence.publishedAtJst.slice(0, 10) >= STAGE1_FROM ? 1 : include ? 2 : null,
    audit: {
      rawPostId: candidate.rawPostId,
      sourceLocations: candidate.sourceLocations,
      collision: candidate.collision,
      unresolvedH2s: body.unresolvedH2s,
      siblingPaths: body.siblingPaths,
    },
  };
  record.slug = initialSlug(record, candidate);
  if (record.include) {
    const evidenceFailures =
      record.evidenceKind === "log_verified"
        ? checkLogEvidence(record, logIndex, sourceDate(candidate))
        : checkPrimaryEvidence(record, candidate.frontmatter);
    const conflicts = checkConflict(
      candidate.frontmatter,
      logIndex,
      record.postId,
    );
    const failures = [...evidenceFailures, ...conflicts];
    if (failures.length > 0) {
      record.include = false;
      record.stage = null;
      record.excludeReason = `evidence gate: ${failures.join(" | ")}`;
    }
  }
  return record;
}

function findUnmatchedEvidenceCandidates(records, logIndex) {
  const rows = [...new Set([...logIndex.values()].flat())].filter(
    (row) => row.account === "SITIONjp" && row.status === "published",
  );
  return records.flatMap((record) => {
    if (!/^(?:no publish evidence|postId collision unresolved)/.test(
      record.excludeReason ?? "",
    )) {
      return [];
    }
    const sourceFileDate = record.sourcePath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!sourceFileDate) return [];
    return rows
      .filter((row) => {
        const key = row.id ?? row.article_id;
        if (key === record.postId || row.article_id === record.postId) {
          return false;
        }
        const jst = utcToJstIso(row.published_at);
        return (
          jst &&
          hoursBetween(jst, `${sourceFileDate}T00:00:00+09:00`) <= 48 &&
          normalizeTitle(row.title) === normalizeTitle(record.titleOriginal)
        );
      })
      .map((row) => ({
        postId: record.postId,
        logId: row.id ?? row.article_id,
        logUrl: row.url,
        logPublishedAt: row.published_at,
      }));
  });
}

function summarize(records, raw, unmatchedEvidence) {
  const countBy = (key, subset = records) =>
    Object.fromEntries(
      [...new Set(subset.map((record) => record[key] ?? "null"))]
        .sort()
        .map((value) => [
          value,
          subset.filter((record) => (record[key] ?? "null") === value).length,
        ]),
    );
  const remediation = records.filter((record) =>
    record.excludeReason?.startsWith("forbidden terms require remediation:"),
  );
  const h2QaRecords = records.filter((record) => {
    const hasH2 =
      record.publicH2s.length +
        record.internalH2s.length +
        record.audit.unresolvedH2s.length >
      0;
    return (
      hasH2 &&
      (record.sourcePath.startsWith(`${MAIN_ROOT}/`)
        ? record.bodySelector === "exact_marker"
        : true)
    );
  });
  return {
    total: records.length,
    included: records.filter((record) => record.include).length,
    evidenceUnionBeforeRemediation:
      records.filter((record) => record.include).length + remediation.length,
    remediationRecords: remediation.length,
    evidenceKind: countBy(
      "evidenceKind",
      records.filter((record) => record.include),
    ),
    family: countBy("family"),
    stage: countBy("stage", records.filter((record) => record.include)),
    timeBasis: countBy(
      "timeBasis",
      records,
    ),
    titleTransform: countBy("titleTransform"),
    bodySelector: countBy("bodySelector"),
    unresolvedRecords: records.filter(
      (record) => record.audit.unresolvedH2s.length > 0,
    ).length,
    h2Records: h2QaRecords.length,
    allH2Records: records.filter(
      (record) => record.publicH2s.length + record.internalH2s.length + record.audit.unresolvedH2s.length > 0,
    ).length,
    h2SiblingRecords: h2QaRecords.filter(
      (record) => record.audit.siblingPaths.length > 0,
    ).length,
    collisionRecords: records.filter((record) => record.audit.collision).length,
    unmatchedEvidenceCandidates: new Set(
      unmatchedEvidence.map((candidate) => candidate.postId),
    ).size,
    unmatchedEvidencePairs: unmatchedEvidence.length,
    raw,
  };
}

function renderReport(summary, records, unmatchedEvidence) {
  const json = (value) => `\`${JSON.stringify(value)}\``;
  const excluded = records.filter((record) => !record.include);
  const unresolved = records.filter(
    (record) => record.audit.unresolvedH2s.length > 0,
  );
  return [
    "# G42 Article Migration Audit Report v1",
    "",
    `- Total candidates: ${summary.total}`,
    `- Included evidence union: ${summary.included}`,
    `- Evidence union before remediation exclusions: ${summary.evidenceUnionBeforeRemediation}`,
    `- Remediation records: ${summary.remediationRecords}`,
    `- Evidence kinds: ${json(summary.evidenceKind)}`,
    `- Families: ${json(summary.family)}`,
    `- Stages: ${json(summary.stage)}`,
    `- Time basis: ${json(summary.timeBasis)}`,
    `- Title transforms: ${json(summary.titleTransform)}`,
    `- Body selectors: ${json(summary.bodySelector)}`,
    `- H2 records: ${summary.h2Records}`,
    `- All selected-body H2 records: ${summary.allH2Records}`,
    `- H2 records with sibling publication bodies: ${summary.h2SiblingRecords}`,
    `- Unresolved records: ${summary.unresolvedRecords}`,
    `- Collision records: ${summary.collisionRecords}`,
    `- Unmatched evidence candidates: ${summary.unmatchedEvidenceCandidates} records / ${summary.unmatchedEvidencePairs} record-log pairs`,
    `- Raw population: ${json(summary.raw)}`,
    "",
    "## Excluded",
    "",
    ...excluded.map(
      (record) => `- ${record.postId}: ${record.excludeReason}`,
    ),
    "",
    "## Unresolved H2 classifications",
    "",
    ...unresolved.map(
      (record) =>
        `- ${record.postId}: ${record.audit.unresolvedH2s.join(" | ")}`,
    ),
    "",
    "## PostId collision resolution",
    "",
    ...records
      .filter((record) => record.audit.collision)
      .map(
        (record) =>
          `- raw=${record.audit.rawPostId} manifest=${record.postId} include=${record.include} reason=${record.excludeReason ?? "resolved"}`,
      ),
    "",
    "## Unmatched evidence candidates",
    "",
    ...(unmatchedEvidence.length > 0
      ? unmatchedEvidence.map(
          (candidate) =>
            `- ${candidate.postId} <- ${candidate.logId} (${candidate.logPublishedAt}; ${candidate.logUrl})`,
        )
      : ["- none"]),
    "",
  ].join("\n");
}

export function auditSourceRoot(sourceRoot, options = {}) {
  const { main, docs } = collectWorktreeCandidates(sourceRoot);
  const archive = options.includeArchive === false
    ? { commit: null, candidates: [] }
    : collectArchiveCandidates(sourceRoot);
  const selected = selectLogicalCandidates([
    ...main,
    ...docs,
    ...archive.candidates,
  ]);
  const logIndex = loadPublishedLog(sourceRoot);
  const records = selected.map((candidate) =>
    buildRecord(sourceRoot, candidate, logIndex, archive.commit),
  );
  assignDailySlugs(records);
  const unmatchedEvidence = findUnmatchedEvidenceCandidates(records, logIndex);
  const summary = summarize(records, {
    main: main.length,
    docs: docs.length,
    archive: archive.candidates.length,
  }, unmatchedEvidence);
  return {
    records,
    summary,
    unmatchedEvidence,
    report: renderReport(summary, records, unmatchedEvidence),
  };
}

function cli() {
  const sourceRootArg = process.argv.find((argument) =>
    argument.startsWith("--source-root="),
  );
  const outArg = process.argv.find((argument) => argument.startsWith("--out="));
  const reportArg = process.argv.find((argument) =>
    argument.startsWith("--report="),
  );
  if (!sourceRootArg || !outArg || !reportArg) {
    console.error(
      "usage: audit.mjs --source-root=<root> --out=<json> --report=<md>",
    );
    process.exit(1);
  }
  const sourceRoot = sourceRootArg.slice("--source-root=".length);
  const out = outArg.slice("--out=".length);
  const report = reportArg.slice("--report=".length);
  const result = auditSourceRoot(sourceRoot);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result.records, null, 2)}\n`);
  fs.writeFileSync(report, result.report);
  console.log(JSON.stringify(result.summary, null, 2));
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  cli();
}
