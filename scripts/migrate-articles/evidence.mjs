import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const STN_X_URL = /^https:\/\/x\.com\/SITIONjp\/status\/\d+$/;

export function loadPublishedLog(sourceRoot) {
  const logPath = path.join(
    sourceRoot,
    "07_DATA/content/published_log.jsonl",
  );
  const index = new Map();
  for (const line of fs.readFileSync(logPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const keys =
      row.article_id && row.article_id !== row.id
        ? [row.id, row.article_id]
        : [row.id];
    for (const key of keys) {
      if (typeof key === "string" && key) {
        index.set(key, [...(index.get(key) ?? []), row]);
      }
    }
  }
  return index;
}

export function readSourceText(sourceRoot, sourceRef, relativePath) {
  if (sourceRef === "worktree") {
    return fs.readFileSync(path.join(sourceRoot, relativePath), "utf8");
  }
  const commit = sourceRef.split(":")[1];
  return execFileSync(
    "git",
    ["-C", sourceRoot, "show", `${commit}:${relativePath}`],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
}

export function parseFrontmatter(markdown) {
  const block = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!block) {
    return {
      postId: null,
      status: null,
      publishedUrl: null,
      publishedAt: null,
      title: null,
    };
  }
  const pick = (key) => {
    const match = block[1].match(
      new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m"),
    );
    return match ? match[1].trim() : null;
  };
  return {
    postId: pick("post_id"),
    status: pick("status"),
    publishedUrl: pick("published_url"),
    publishedAt: pick("published_at"),
    title: pick("title"),
  };
}

export function normalizeTitle(title) {
  return (title ?? "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}、。・｜—\-]/gu, "");
}

const ISO_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const pad2 = (number) => String(number).padStart(2, "0");

export function utcToJstIso(utcIso) {
  if (typeof utcIso !== "string") return null;
  const match = utcIso.match(ISO_DATETIME);
  if (!match) return null;
  const milliseconds = Date.parse(utcIso);
  if (Number.isNaN(milliseconds)) return null;

  const offsetMinutes =
    match[7] === "Z"
      ? 0
      : (match[7].startsWith("-") ? -1 : 1) *
        (Number(match[7].slice(1, 3)) * 60 +
          Number(match[7].slice(4, 6)));
  const local = new Date(milliseconds + offsetMinutes * 60_000);
  const roundTrip = `${local.getUTCFullYear()}-${pad2(
    local.getUTCMonth() + 1,
  )}-${pad2(local.getUTCDate())}T${pad2(local.getUTCHours())}:${pad2(
    local.getUTCMinutes(),
  )}:${pad2(local.getUTCSeconds())}`;
  if (!utcIso.startsWith(roundTrip)) return null;

  const jst = new Date(milliseconds + 9 * 3_600_000);
  return `${jst.getUTCFullYear()}-${pad2(jst.getUTCMonth() + 1)}-${pad2(
    jst.getUTCDate(),
  )}T${pad2(jst.getUTCHours())}:${pad2(
    jst.getUTCMinutes(),
  )}:00+09:00`;
}

export function hoursBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.abs(a - b) / 3_600_000;
}

export function checkLogEvidence(record, logIndex, sourceFileDate) {
  const failures = [];
  const rows = (logIndex.get(record.postId) ?? []).filter(
    (row) =>
      row.account === "SITIONjp" &&
      row.status === "published" &&
      (row.id === record.postId || row.article_id === record.postId),
  );
  if (rows.length === 0) {
    return [`no published SITIONjp log row with exact key ${record.postId}`];
  }
  const row = rows[rows.length - 1];

  if (!STN_X_URL.test(row.url ?? "")) {
    failures.push(`log url form invalid: ${row.url}`);
  }
  if (record.logUrl !== row.url) {
    failures.push("manifest logUrl != log url");
  }
  if (record.sourceXUrl !== row.url) {
    failures.push("sourceXUrl != log url");
  }
  if (record.logPublishedAtUtc !== row.published_at) {
    failures.push(
      `manifest logPublishedAtUtc != log published_at (${record.logPublishedAtUtc} vs ${row.published_at})`,
    );
  }
  if (record.logTitle !== row.title) {
    failures.push("manifest logTitle != log title");
  }

  const jst = utcToJstIso(row.published_at);
  if (!jst) {
    failures.push(`log published_at is not valid ISO: ${row.published_at}`);
  } else {
    if (jst.slice(0, 16) !== record.publishedAtJst.slice(0, 16)) {
      failures.push(
        `publishedAtJst != log time in JST (${record.publishedAtJst} vs ${jst})`,
      );
    }
    if (
      hoursBetween(jst, `${sourceFileDate}T00:00:00+09:00`) > 48
    ) {
      failures.push(
        `log time beyond ±48h of source file date ${sourceFileDate}`,
      );
    }
  }

  const recomputedMatch =
    row.title === record.titleOriginal
      ? "exact"
      : normalizeTitle(row.title) === normalizeTitle(record.titleOriginal)
        ? "normalized"
        : "manual";
  if (recomputedMatch !== record.titleMatch) {
    failures.push(
      `titleMatch recomputed=${recomputedMatch} declared=${record.titleMatch}`,
    );
  }
  return failures;
}

export function checkPrimaryEvidence(record, frontmatter) {
  const failures = [];
  if (!['published', 'posted'].includes(frontmatter.status ?? '')) {
    failures.push(
      `frontmatter status is not published/posted: ${frontmatter.status}`,
    );
  }
  if (!frontmatter.publishedUrl) {
    failures.push("frontmatter published_url missing");
  } else {
    if (frontmatter.publishedUrl !== record.primaryUrl) {
      failures.push("manifest primaryUrl != frontmatter published_url");
    }
    if (record.sourceXUrl !== frontmatter.publishedUrl) {
      failures.push("sourceXUrl != frontmatter published_url");
    }
  }
  if (!frontmatter.publishedAt) {
    failures.push(
      "frontmatter published_at missing (primary evidence requires it; reclassify as log_verified or exclude)",
    );
  } else {
    const jst = /\+09:00$/.test(frontmatter.publishedAt)
      ? frontmatter.publishedAt
      : utcToJstIso(frontmatter.publishedAt);
    if (
      !jst ||
      jst.slice(0, 16) !== record.publishedAtJst.slice(0, 16)
    ) {
      failures.push(
        `publishedAtJst != frontmatter published_at (${record.publishedAtJst} vs ${frontmatter.publishedAt})`,
      );
    }
  }
  return failures;
}

export function checkConflict(frontmatter, logIndex, postId) {
  const rows = (logIndex.get(postId) ?? []).filter(
    (row) =>
      row.account === "SITIONjp" &&
      row.status === "published" &&
      (row.id === postId || row.article_id === postId) &&
      row.url,
  );
  if (!frontmatter.publishedUrl || rows.length === 0) return [];
  const latest = rows[rows.length - 1];
  return frontmatter.publishedUrl !== latest.url
    ? [
        `frontmatter/log URL conflict: ${frontmatter.publishedUrl} vs ${latest.url}`,
      ]
    : [];
}
