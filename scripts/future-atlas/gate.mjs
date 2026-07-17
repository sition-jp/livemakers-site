#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { matchesTermEdgeAware, scanForbidden } from "../migrate-articles/scan.mjs";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : "origin/main";

if (!baseRef) {
  console.error("FAIL future-atlas gate: --base requires a ref");
  process.exit(1);
}

const git = (gitArgs, options = {}) => execFileSync("git", gitArgs, {
  cwd: options.cwd,
  encoding: options.encoding ?? "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).toString();

const repoRoot = git(["rev-parse", "--show-toplevel"]).trim();
const ATLAS_ROOT = "content/future-atlas";
const CONFIG_PATH = `${ATLAS_ROOT}/config.json`;
const MANIFEST_PATH = `${ATLAS_ROOT}/manifest.json`;
const EVENTS_PATH = `${ATLAS_ROOT}/events.jsonl`;
const VOCABULARY_PATH = `${ATLAS_ROOT}/vocabulary.json`;
const CONTRACTS_ROOT = `${ATLAS_ROOT}/contracts`;
const METHODOLOGY_ROOT = `${ATLAS_ROOT}/methodology`;
const MUTABLE_MANIFEST_FIELDS = [
  "themes",
  "atlasPlacement",
  "relatedArticleIds",
  "authorDisplay",
  "authorshipMode",
];

const failures = [];
const warnings = [];
const fail = (message) => failures.push(message);

const currentPath = (relativePath) => path.join(repoRoot, relativePath);
const currentExists = (relativePath) => fs.existsSync(currentPath(relativePath));
const readCurrentText = (relativePath) => fs.readFileSync(currentPath(relativePath), "utf8");
const readCurrentJson = (relativePath) => JSON.parse(readCurrentText(relativePath));

const showAtRef = (ref, relativePath, encoding = "utf8") => {
  try {
    return execFileSync("git", ["show", `${ref}:${relativePath}`], {
      cwd: repoRoot,
      encoding,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
};

const readJsonAtRef = (ref, relativePath) => {
  const text = showAtRef(ref, relativePath, "utf8");
  return text === null ? null : JSON.parse(text);
};

const listAtRef = (ref, relativePath) => {
  try {
    return git(["ls-tree", "-r", "--name-only", ref, "--", relativePath])
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return [];
  }
};

const listCurrentFiles = (relativeDir, predicate = () => true) => {
  const directory = currentPath(relativeDir);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => `${relativeDir}/${entry.name}`)
    .sort();
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};

const deepEqual = (left, right) =>
  JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

const parseEvents = (text) => text
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line));

const currentJstDate = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
};

const addDays = (isoDate, days) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear(),
    String(result.getUTCMonth() + 1).padStart(2, "0"),
    String(result.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const firstIntroductionCommit = (relativePath) => {
  const output = git(["log", "--diff-filter=A", "--format=%H", "--", relativePath]).trim();
  return output.split(/\r?\n/).filter(Boolean)[0] ?? null;
};

const collectStrings = (value, target) => {
  if (typeof value === "string") {
    target.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, target);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, target);
  }
};

const run = () => {
  git(["rev-parse", "--verify", baseRef]);

  if (!currentExists(CONFIG_PATH) || !currentExists(MANIFEST_PATH)) {
    fail("required Future Atlas config or manifest is missing");
    return;
  }

  const config = readCurrentJson(CONFIG_PATH);
  const manifest = readCurrentJson(MANIFEST_PATH);
  const baseConfig = readJsonAtRef(baseRef, CONFIG_PATH) ?? {
    schemaVersion: 1,
    surfacePublished: false,
  };
  const baseManifest = readJsonAtRef(baseRef, MANIFEST_PATH) ?? {
    schemaVersion: 1,
    themes: [],
    entries: [],
  };

  const contractPaths = listCurrentFiles(CONTRACTS_ROOT, (name) => name.endsWith(".json"));
  const baseContractPaths = listAtRef(baseRef, CONTRACTS_ROOT)
    .filter((name) => name.endsWith(".json"));
  const baseContractSet = new Set(baseContractPaths);
  const currentContractSet = new Set(contractPaths);
  const newContractPaths = contractPaths.filter((name) => !baseContractSet.has(name));

  for (const contractPath of baseContractPaths) {
    if (!currentContractSet.has(contractPath)) {
      fail(`guard #3 contract deleted: ${contractPath}`);
      continue;
    }
    const baseBytes = showAtRef(baseRef, contractPath, null);
    const headBytes = fs.readFileSync(currentPath(contractPath));
    if (!Buffer.from(baseBytes).equals(headBytes)) {
      fail(`guard #2 frozen contract modified: ${contractPath}`);
    }
  }

  const baseEventsText = showAtRef(baseRef, EVENTS_PATH, "utf8") ?? "";
  const eventsText = currentExists(EVENTS_PATH) ? readCurrentText(EVENTS_PATH) : "";
  if (!eventsText.startsWith(baseEventsText)) {
    fail("guards #3/#4 events ledger must remain an append-only byte prefix");
  }
  const baseEvents = parseEvents(baseEventsText);
  const events = parseEvents(eventsText);
  const baseEventIds = new Set(baseEvents.map((event) => event.eventId));
  const appendedEvents = events.filter((event) => !baseEventIds.has(event.eventId));

  const eventIds = new Set();
  for (const event of events) {
    if (eventIds.has(event.eventId)) fail(`duplicate eventId: ${event.eventId}`);
    eventIds.add(event.eventId);
  }

  const contracts = contractPaths.map((contractPath) => ({
    path: contractPath,
    value: readCurrentJson(contractPath),
  }));
  const contractsById = new Map(contracts.map((entry) => [entry.value.forecastId, entry.value]));
  if (contractsById.size !== contracts.length) fail("duplicate forecastId across contracts");

  for (const { path: contractPath, value: contract } of contracts) {
    const expectedPath = `${CONTRACTS_ROOT}/${contract.forecastId}.json`;
    if (contractPath !== expectedPath) {
      fail(`contract filename must equal ${contract.forecastId}.json`);
    }
  }

  for (const contractPath of newContractPaths) {
    const contract = readCurrentJson(contractPath);
    const articlePath = `content/articles/${contract.articleId}/meta.json`;
    const contractCommit = firstIntroductionCommit(contractPath);
    const articleCommit = firstIntroductionCommit(articlePath);
    if (!contractCommit || contractCommit !== articleCommit) {
      fail(`guard #16 introduction commit must match for contract and article: ${contract.forecastId}`);
      continue;
    }
    const commitManifest = readJsonAtRef(contractCommit, MANIFEST_PATH);
    const parentManifest = readJsonAtRef(`${contractCommit}^`, MANIFEST_PATH) ?? {
      entries: [],
    };
    const presentAtCommit = commitManifest?.entries?.some(
      (entry) => entry.articleId === contract.articleId && entry.kind === "forecast",
    );
    const presentBeforeCommit = parentManifest.entries?.some(
      (entry) => entry.articleId === contract.articleId,
    );
    if (!presentAtCommit || presentBeforeCommit) {
      fail(`guard #16 manifest forecast entry must be introduced in the contract commit: ${contract.articleId}`);
    }
  }

  const resolvedForecastIds = new Set(
    events
      .filter((event) => event.type === "resolution" || event.type === "resolution_correction")
      .map((event) => event.forecastId),
  );
  const openContracts = contracts
    .map((entry) => entry.value)
    .filter((contract) => !resolvedForecastIds.has(contract.forecastId));
  const overdue = openContracts.filter(
    (contract) => currentJstDate() > addDays(contract.dueAt, 14),
  );
  if (newContractPaths.length > 0 && overdue.length > 0) {
    fail(`guard #12 overdue forecasts block new forecast files: ${overdue.map((item) => item.forecastId).join(", ")}`);
  }

  const highConvictionOpen = openContracts.filter(
    (contract) => contract.confidence === "high_conviction",
  ).length;
  if (openContracts.length > 0 && highConvictionOpen / openContracts.length > 1 / 3) {
    warnings.push("guard #21 high_conviction_share_exceeded");
  }

  const baseEntries = new Map((baseManifest.entries ?? []).map((entry) => [entry.articleId, entry]));
  const headEntries = new Map((manifest.entries ?? []).map((entry) => [entry.articleId, entry]));
  for (const [articleId, baseEntry] of baseEntries) {
    const headEntry = headEntries.get(articleId);
    if (!headEntry) {
      fail(`manifest entry deleted; articleId is immutable: ${articleId}`);
      continue;
    }
    if (baseEntry.kind !== headEntry.kind) {
      fail(`guard #18 kind is immutable for ${articleId}: ${baseEntry.kind} -> ${headEntry.kind}`);
    }
    for (const field of MUTABLE_MANIFEST_FIELDS) {
      if (deepEqual(baseEntry[field], headEntry[field])) continue;
      const candidates = appendedEvents.filter(
        (event) => event.type === "metadata_correction"
          && event.articleId === articleId
          && event.field === field,
      );
      if (candidates.length === 0) {
        fail(`guard #17 metadata_correction required for ${articleId}.${field}`);
        continue;
      }
      const beforeMatches = candidates.filter((event) => deepEqual(event.before, baseEntry[field]));
      if (beforeMatches.length === 0) {
        fail(`guard #17 metadata_correction before must equal base manifest for ${articleId}.${field}`);
        continue;
      }
      if (!beforeMatches.some((event) => deepEqual(event.after, headEntry[field]))) {
        fail(`guard #17 metadata_correction after must equal HEAD manifest for ${articleId}.${field}`);
      }
    }
  }

  for (const event of events) {
    if (event.forecastId && !contractsById.has(event.forecastId)) {
      fail(`event forecastId has no contract: ${event.forecastId}`);
    }
    if (event.type !== "resolution" && event.type !== "resolution_correction") continue;
    const contract = contractsById.get(event.forecastId);
    if (!contract) continue;
    const materials = Array.isArray(event.materials) ? event.materials : [];
    const sources = Array.isArray(contract.resolutionSources) ? contract.resolutionSources : [];
    const referencesNamedSource = materials.some((material) =>
      sources.some((source) => material === source || material.startsWith(source)));
    if (!referencesNamedSource) {
      fail(`guard #19 materials must reference resolutionSources for ${event.forecastId}`);
    }
  }

  if (!currentExists(VOCABULARY_PATH)) {
    fail("Future Atlas vocabulary is missing");
  } else {
    const vocabulary = readCurrentJson(VOCABULARY_PATH);
    const baseVocabulary = readJsonAtRef(baseRef, VOCABULARY_PATH);
    if (baseVocabulary) {
      const baseTokens = baseVocabulary.forbiddenExactTokens ?? [];
      const headTokens = vocabulary.forbiddenExactTokens ?? [];
      const prefixMatches = baseTokens.every((token, index) => headTokens[index] === token);
      if (headTokens.length < baseTokens.length || !prefixMatches) {
        fail("vocabulary forbiddenExactTokens must preserve the append-only prefix");
      }
    }
    const forbidden = new Set(vocabulary.forbiddenExactTokens ?? []);
    const overlap = (vocabulary.allowedPublicTerms ?? []).filter((term) => forbidden.has(term));
    if (overlap.length > 0) {
      fail(`allowedPublicTerms and forbiddenExactTokens overlap: ${overlap.join(", ")}`);
    }

    const publicStrings = [];
    for (const theme of manifest.themes ?? []) {
      if (typeof theme.titleJa === "string") publicStrings.push([`manifest theme ${theme.key} titleJa`, theme.titleJa]);
      if (typeof theme.titleEn === "string") publicStrings.push([`manifest theme ${theme.key} titleEn`, theme.titleEn]);
    }
    for (const entry of manifest.entries ?? []) {
      publicStrings.push([`manifest ${entry.articleId} authorDisplay`, entry.authorDisplay]);
    }
    for (const { value: contract } of contracts) {
      publicStrings.push([`contract ${contract.forecastId} claim`, contract.claim]);
      publicStrings.push([`contract ${contract.forecastId} resolutionCriteria`, contract.resolutionCriteria]);
      for (const source of contract.resolutionSources ?? []) {
        publicStrings.push([`contract ${contract.forecastId} resolutionSources`, source]);
      }
    }
    for (const event of events) {
      for (const [field, value] of [
        ["note", event.note],
        ["materials", event.materials],
        ["reason", event.reason],
        ["secondReview.reviewNote", event.secondReview?.reviewNote],
        ["before", event.type === "metadata_correction" ? event.before : undefined],
        ["after", event.type === "metadata_correction" ? event.after : undefined],
      ]) {
        const strings = [];
        collectStrings(value, strings);
        for (const text of strings) publicStrings.push([`event ${event.eventId} ${field}`, text]);
      }
    }

    for (const locale of ["ja", "en"]) {
      const methodologyPath = `${METHODOLOGY_ROOT}/${locale}.md`;
      if (currentExists(methodologyPath)) {
        publicStrings.push([`methodology ${locale}`, readCurrentText(methodologyPath)]);
      }
    }

    for (const entry of manifest.entries ?? []) {
      for (const locale of ["ja", "en"]) {
        const bodyPath = `content/articles/${entry.articleId}/${locale}.md`;
        if (currentExists(bodyPath)) {
          publicStrings.push([`article ${entry.articleId} ${locale}`, readCurrentText(bodyPath)]);
        }
      }
    }

    for (const locale of ["ja", "en"]) {
      const messagesPath = `messages/${locale}.json`;
      if (!currentExists(messagesPath)) continue;
      const messages = readCurrentJson(messagesPath);
      for (const [label, value] of [
        [`messages ${locale} futureAtlas`, messages.futureAtlas],
        [`messages ${locale} nav.futureAtlas`, messages.nav?.futureAtlas],
        [`messages ${locale} home.family.future-map`, messages.home?.family?.["future-map"]],
        [`messages ${locale} articles.family.future-map`, messages.articles?.family?.["future-map"]],
      ]) {
        const strings = [];
        collectStrings(value, strings);
        for (const text of strings) publicStrings.push([label, text]);
      }
    }

    const scanFailures = new Set();
    for (const [label, text] of publicStrings) {
      if (typeof text !== "string") continue;
      for (const term of scanForbidden(text)) {
        scanFailures.add(`forbidden public term ${term} in ${label}`);
      }
      for (const token of vocabulary.forbiddenExactTokens ?? []) {
        if (matchesTermEdgeAware(text.toLowerCase(), token.toLowerCase())) {
          scanFailures.add(`forbidden token ${token} in ${label}`);
        }
      }
    }
    for (const message of scanFailures) fail(message);
  }

  if (baseConfig.surfacePublished === false && config.surfacePublished === true) {
    const entries = manifest.entries ?? [];
    const declaredThemeKeys = new Set((manifest.themes ?? []).map((theme) => theme.key));
    const themeCount = new Set(
      entries.flatMap((entry) => entry.themes ?? [])
        .filter((themeKey) => declaredThemeKeys.has(themeKey)),
    ).size;
    const visionCount = entries.filter((entry) => entry.kind === "vision").length;
    const reportCount = entries.filter((entry) => entry.kind === "structural_report").length;
    const forecastCount = entries.filter(
      (entry) => entry.kind === "forecast"
        && contracts.some(({ value: contract }) => contract.articleId === entry.articleId),
    ).length;
    const methodologyPublished = currentExists(`${METHODOLOGY_ROOT}/ja.md`)
      && readCurrentText(`${METHODOLOGY_ROOT}/ja.md`).trim().length > 0;
    if (themeCount < 3 || entries.length < 6 || visionCount < 2
        || reportCount < 2 || forecastCount < 1 || !methodologyPublished) {
      fail(
        `publish threshold not met: themes=${themeCount}/3 articles=${entries.length}/6 `
        + `vision=${visionCount}/2 structural_report=${reportCount}/2 forecast=${forecastCount}/1 `
        + `methodology=${methodologyPublished}`,
      );
    }
  }
};

try {
  run();
} catch (error) {
  fail(`fatal gate error: ${error instanceof Error ? error.message : String(error)}`);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (failures.length > 0) {
  console.error(`FAIL future-atlas gate (${failures.length} violation${failures.length === 1 ? "" : "s"})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS future-atlas gate (base=${baseRef})`);
}
