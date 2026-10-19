#!/usr/bin/env node

// Blocks internal operating details from entering this public repository.
//
//   node scripts/public-leak/gate.mjs --base origin/main
//     Checks the change against the base: public-surface files that the change
//     adds or modifies are scanned in full, other files only on added lines.
//
//   node scripts/public-leak/gate.mjs --all
//     Scans every tracked public-surface file in full (audit mode).
//
// Rules live in rules.mjs.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { isPublicSurface, isSelfExcluded, scanLines, scanText } from "./rules.mjs";

const args = process.argv.slice(2);
const auditAll = args.includes("--all");
const baseIndex = args.indexOf("--base");
const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : "origin/main";

if (!auditAll && !baseRef) {
  console.error("FAIL public-leak gate: --base requires a ref");
  process.exit(1);
}

const git = (gitArgs) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...gitArgs], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

const repoRoot = git(["rev-parse", "--show-toplevel"]).trim();

const readTextFile = (relativePath) => {
  const absolute = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolute)) return null;
  const buffer = fs.readFileSync(absolute);
  if (buffer.subarray(0, 8000).includes(0)) return null;
  return buffer.toString("utf8");
};

const scanPublicFiles = (files) =>
  files
    .filter(isPublicSurface)
    .flatMap((file) => {
      const text = readTextFile(file);
      return text === null ? [] : scanText(file, text);
    });

// Parses `git diff --unified=0` into { file: [{ line, text }] } for added lines.
const addedLinesByFile = (diff) => {
  const result = new Map();
  let file = null;
  let nextLine = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      file = raw === "+++ /dev/null" ? null : raw.slice(6);
      continue;
    }
    if (raw.startsWith("@@")) {
      const match = raw.match(/\+(\d+)/);
      nextLine = match ? Number(match[1]) : 0;
      continue;
    }
    if (file && raw.startsWith("+")) {
      if (!result.has(file)) result.set(file, []);
      result.get(file).push({ line: nextLine, text: raw.slice(1) });
      nextLine += 1;
    }
  }
  return result;
};

let findings;
if (auditAll) {
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  findings = scanPublicFiles(tracked);
} else {
  const range = `${baseRef}...HEAD`;
  const changed = git(["diff", "--name-only", "--diff-filter=ACMR", "-z", range])
    .split("\0")
    .filter(Boolean)
    .filter((file) => !isSelfExcluded(file));
  const diff = git(["diff", "--unified=0", "--no-color", "--no-ext-diff", "--diff-filter=ACMR", range]);
  const added = addedLinesByFile(diff);
  findings = [
    ...scanPublicFiles(changed),
    ...changed
      .filter((file) => !isPublicSurface(file))
      .flatMap((file) => scanLines(file, added.get(file) ?? [])),
  ];
}

if (findings.length > 0) {
  console.error(`FAIL public-leak gate: ${findings.length} finding(s). This repository is public.`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  [${finding.rule}] ${finding.label}: ${finding.match}`);
  }
  console.error("Remove the internal detail, or add `public-leak-allow` on the line if it is intended to be public.");
  process.exit(1);
}

console.log(`OK public-leak gate (${auditAll ? "all public-surface files" : `changes since ${baseRef}`})`);
