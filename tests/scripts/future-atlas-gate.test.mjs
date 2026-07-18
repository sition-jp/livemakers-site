import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_DIR, "../..");
const GATE_PATH = path.join(PROJECT_ROOT, "scripts/future-atlas/gate.mjs");
const WORKFLOW_PATH = path.join(PROJECT_ROOT, ".github/workflows/future-atlas-guards.yml");

const FORBIDDEN = [
  "EWS", "LIS", "20 Scenarios", "20シナリオ", "Layer A", "Layer B", "Layer C",
  "G0_docs_only", "G1_read_only_observation", "Phase 2-A", "EWS Composite",
  "Convergence", "昇格ゲート", "Signal 昇格",
];

const roots = [];

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const writeText = (root, relativePath, text) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};

const writeJson = (root, relativePath, value) =>
  writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);

const readJson = (root, relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const safeMessages = () => ({
  nav: { futureAtlas: "未来アトラス" },
  home: { family: { "future-map": "未来アトラス" } },
  articles: { family: { "future-map": "未来アトラス" } },
  futureAtlas: { heading: "未来を考えるための地図" },
});

const emptyManifest = () => ({ schemaVersion: 1, themes: [], entries: [] });

const initRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lmk-fa-gate-"));
  roots.push(root);
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.email", "tests@example.com"]);
  git(root, ["config", "user.name", "Future Atlas Tests"]);
  writeJson(root, "content/future-atlas/config.json", { schemaVersion: 1, surfacePublished: false });
  writeJson(root, "content/future-atlas/manifest.json", emptyManifest());
  writeText(root, "content/future-atlas/events.jsonl", "");
  writeJson(root, "content/future-atlas/vocabulary.json", {
    schemaVersion: 1,
    forbiddenExactTokens: FORBIDDEN,
    allowedPublicTerms: ["先行指標"],
    notes: "append-only",
  });
  writeText(root, "content/future-atlas/contracts/.gitkeep", "");
  writeText(root, "content/future-atlas/methodology/ja.md", "# 未来予測の作法\n\n安全な本文。\n");
  writeJson(root, "messages/ja.json", safeMessages());
  writeJson(root, "messages/en.json", safeMessages());
  writeJson(root, "scripts/migrate-articles/forbidden-terms.json", {
    allowedPublicLabels: [], designTerms: [], opsTerms: [], bodyExemptTerms: [],
  });
  commitAll(root, "base");
  markBase(root);
  return root;
};

const commitAll = (root, message) => {
  git(root, ["add", "--all"]);
  git(root, ["commit", "-m", message]);
};

const markBase = (root) => git(root, ["tag", "--force", "BASE"]);

const addArticle = (
  root,
  articleId,
  { family = "future-map", publishedAtJst = "2026-07-17T09:00:00+09:00", ja = "安全な本文", en } = {},
) => {
  writeJson(root, `content/articles/${articleId}/meta.json`, {
    articleId,
    family,
    titleJa: articleId,
    publishedAtJst,
    publishedLabel: "07-17 09:00 公開",
    lanes: [],
  });
  writeText(root, `content/articles/${articleId}/ja.md`, `${ja}\n`);
  if (en !== undefined) writeText(root, `content/articles/${articleId}/en.md`, `${en}\n`);
};

const ensureTheme = (manifest, key) => {
  if (!manifest.themes.some((theme) => theme.key === key)) {
    manifest.themes.push({ key, titleJa: key, titleEn: key, order: manifest.themes.length });
  }
};

const addManifestEntry = (
  root,
  articleId,
  { kind = "forecast", theme = "ai", authorshipMode = "human_written" } = {},
) => {
  const manifest = readJson(root, "content/future-atlas/manifest.json");
  ensureTheme(manifest, theme);
  manifest.entries.push({
    articleId,
    kind,
    themes: [theme],
    atlasPlacement: manifest.entries.length,
    relatedArticleIds: [],
    authorDisplay: "田平茂樹",
    authorshipMode,
  });
  writeJson(root, "content/future-atlas/manifest.json", manifest);
};

const addContract = (
  root,
  forecastId,
  articleId,
  {
    claim = "検証可能な主張",
    publishedAtJst = "2026-07-17T09:00:00+09:00",
    dueAt = "2027-07-17",
    resolutionSources = ["公式発表"],
  } = {},
) => {
  writeJson(root, `content/future-atlas/contracts/${forecastId}.json`, {
    schemaVersion: 1,
    forecastId,
    claim,
    evidenceCutoff: publishedAtJst.slice(0, 10),
    publishedAtJst,
    dueAt,
    resolutionCriteria: "公式発表で判定する",
    resolutionSources,
    confidence: "base_case",
    articleId,
    authorId: "tabira",
  });
};

const addForecast = (root, forecastId = "fc-a", articleId = "future-map-a", options = {}) => {
  const publishedAtJst = options.publishedAtJst ?? "2026-07-17T09:00:00+09:00";
  addArticle(root, articleId, { publishedAtJst, ja: options.ja, en: options.en });
  addManifestEntry(root, articleId, { kind: "forecast", theme: options.theme ?? "ai" });
  addContract(root, forecastId, articleId, { ...options, publishedAtJst });
};

const addVision = (root, articleId, kind = "vision", theme = "ai", body = {}) => {
  addArticle(root, articleId, body);
  addManifestEntry(root, articleId, { kind, theme });
};

const appendEvents = (root, events) => {
  const target = path.join(root, "content/future-atlas/events.jsonl");
  fs.appendFileSync(target, events.map((event) => `${JSON.stringify(event)}\n`).join(""));
};

const runGate = (root) => {
  const result = spawnSync(process.execPath, [GATE_PATH, "--base", "BASE"], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};

const expectFail = (root, pattern) => {
  const result = runGate(root);
  expect(result.status, result.output).toBe(1);
  expect(result.output).toMatch(pattern);
};

const expectPass = (root) => {
  const result = runGate(root);
  expect(result.status, result.output).toBe(0);
  expect(result.output).toMatch(/PASS.*future-atlas/i);
};

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("future-atlas gate", () => {
  it("rejects a byte change to a frozen contract (guard #2)", () => {
    const root = initRepo();
    addForecast(root);
    commitAll(root, "add forecast");
    markBase(root);
    const current = readJson(root, "content/future-atlas/contracts/fc-a.json");
    writeJson(root, "content/future-atlas/contracts/fc-a.json", { ...current, claim: "書換後" });
    commitAll(root, "rewrite contract");
    expectFail(root, /frozen contract modified/i);
  });

  it("rejects contract deletion and events prefix shrinkage (guards #3/#4)", () => {
    const root = initRepo();
    addForecast(root);
    appendEvents(root, [{
      type: "evidence_added", eventId: "ev-1", date: "2026-07-18", forecastId: "fc-a", materials: [],
    }]);
    commitAll(root, "add forecast and event");
    markBase(root);
    fs.rmSync(path.join(root, "content/future-atlas/contracts/fc-a.json"));
    writeText(root, "content/future-atlas/events.jsonl", "");
    commitAll(root, "delete history");
    expectFail(root, /contract deleted|events.*append-only/i);
  });

  it("accepts append-only event growth", () => {
    const root = initRepo();
    addForecast(root);
    commitAll(root, "add forecast");
    markBase(root);
    appendEvents(root, [{
      type: "evidence_added", eventId: "ev-1", date: "2026-07-18", forecastId: "fc-a", materials: [],
    }]);
    commitAll(root, "append event");
    expectPass(root);
  });

  it("blocks a new forecast while an overdue forecast remains open (guard #12)", () => {
    const root = initRepo();
    addForecast(root, "fc-old", "future-map-old", {
      publishedAtJst: "2019-01-01T09:00:00+09:00", dueAt: "2020-01-01",
    });
    commitAll(root, "add overdue forecast");
    markBase(root);
    addForecast(root, "fc-new", "future-map-new");
    commitAll(root, "add new forecast");
    expectFail(root, /overdue.*new forecast/i);
  });

  it("allows a new forecast when the same change resolves the overdue forecast", () => {
    const root = initRepo();
    addForecast(root, "fc-old", "future-map-old", {
      publishedAtJst: "2019-01-01T09:00:00+09:00", dueAt: "2020-01-01",
    });
    commitAll(root, "add overdue forecast");
    markBase(root);
    addForecast(root, "fc-new", "future-map-new");
    appendEvents(root, [{
      type: "resolution", eventId: "ev-resolve-old", date: "2026-07-18", forecastId: "fc-old",
      articleId: "future-map-old", materials: ["公式発表: 判定資料"], resolutionStatus: "false", decidedBy: "tabira",
    }]);
    commitAll(root, "resolve old and add new");
    expectPass(root);
  });

  it("rejects article and contract introduced in different commits (guard #16)", () => {
    const root = initRepo();
    addArticle(root, "future-map-a");
    commitAll(root, "article first");
    addManifestEntry(root, "future-map-a");
    addContract(root, "fc-a", "future-map-a");
    commitAll(root, "contract later");
    expectFail(root, /introduction commit.*match/i);
  });

  it("accepts article, contract, and manifest entry introduced in one commit", () => {
    const root = initRepo();
    addForecast(root);
    commitAll(root, "atomic forecast publication");
    expectPass(root);
  });

  it("requires metadata_correction for mutable manifest changes (guard #17)", () => {
    const root = initRepo();
    addForecast(root);
    const manifest = readJson(root, "content/future-atlas/manifest.json");
    ensureTheme(manifest, "finance");
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    commitAll(root, "add forecast");
    markBase(root);
    manifest.entries[0].themes = ["finance"];
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    commitAll(root, "move shelf without correction");
    expectFail(root, /metadata_correction.*themes/i);
  });

  it.each([
    ["wrong before", ["wrong"], ["finance"], /before.*base manifest/i],
    ["wrong after", ["ai"], ["wrong"], /after.*HEAD manifest/i],
  ])("rejects metadata correction with %s", (_label, before, after, pattern) => {
    const root = initRepo();
    addForecast(root);
    const manifest = readJson(root, "content/future-atlas/manifest.json");
    ensureTheme(manifest, "finance");
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    commitAll(root, "add forecast");
    markBase(root);
    manifest.entries[0].themes = ["finance"];
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    appendEvents(root, [{
      type: "metadata_correction", eventId: "ev-meta", date: "2026-07-18",
      articleId: "future-map-a", field: "themes", before, after, reason: "棚移動", materials: [],
    }]);
    commitAll(root, "move shelf with bad correction");
    expectFail(root, pattern);
  });

  it("accepts metadata correction whose before/after deep-equal base and HEAD", () => {
    const root = initRepo();
    addForecast(root);
    const manifest = readJson(root, "content/future-atlas/manifest.json");
    ensureTheme(manifest, "finance");
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    commitAll(root, "add forecast");
    markBase(root);
    manifest.entries[0].themes = ["finance"];
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    appendEvents(root, [{
      type: "metadata_correction", eventId: "ev-meta", date: "2026-07-18",
      articleId: "future-map-a", field: "themes", before: ["ai"], after: ["finance"],
      reason: "棚移動", materials: [],
    }]);
    commitAll(root, "move shelf with correction");
    expectPass(root);
  });

  it("rejects kind changes on an existing manifest entry (guard #18)", () => {
    const root = initRepo();
    addVision(root, "future-map-a", "vision");
    commitAll(root, "add vision");
    markBase(root);
    const manifest = readJson(root, "content/future-atlas/manifest.json");
    manifest.entries[0].kind = "forecast";
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    commitAll(root, "change kind");
    expectFail(root, /kind.*immutable/i);
  });

  it("rejects deletion of an existing manifest entry", () => {
    const root = initRepo();
    addVision(root, "future-map-a", "vision");
    commitAll(root, "add vision");
    markBase(root);
    const manifest = readJson(root, "content/future-atlas/manifest.json");
    manifest.entries = [];
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    commitAll(root, "delete manifest entry");
    expectFail(root, /manifest entry.*deleted|articleId.*immutable/i);
  });

  it("requires resolution materials to reference a named resolution source (guard #19)", () => {
    const root = initRepo();
    addForecast(root);
    commitAll(root, "add forecast");
    markBase(root);
    appendEvents(root, [{
      type: "resolution", eventId: "ev-resolution", date: "2027-07-17", forecastId: "fc-a",
      articleId: "future-map-a", materials: ["無関係な資料"], resolutionStatus: "true", decidedBy: "tabira",
    }]);
    commitAll(root, "resolve without named source");
    expectFail(root, /materials.*resolutionSources/i);
  });

  it.each([
    ["contract claim", (root) => addForecast(root, "fc-a", "future-map-a", { claim: "EWS を公開" })],
    ["article en body", (root) => addVision(root, "future-map-a", "vision", "ai", { en: "EWS in public" })],
    ["methodology", (root) => writeText(root, "content/future-atlas/methodology/ja.md", "# EWS\n")],
  ])("scans forbidden exact tokens in %s", (_label, mutate) => {
    const root = initRepo();
    mutate(root);
    commitAll(root, "add forbidden public copy");
    expectFail(root, /forbidden token.*EWS/i);
  });

  it.each([
    ["resolution material", {
      type: "resolution", eventId: "ev-resolution", date: "2027-07-17", forecastId: "fc-a",
      articleId: "future-map-a", materials: ["公式発表 EWS"], resolutionStatus: "true", decidedBy: "tabira",
    }],
    ["second review note", {
      type: "resolution", eventId: "ev-resolution", date: "2027-07-17", forecastId: "fc-a",
      note: "判定不能", materials: ["公式発表"], resolutionStatus: "indeterminate", decidedBy: "tabira",
      secondReview: { reviewer: "reviewer", reviewedAt: "2027-07-17", reviewDecision: "agree", reviewNote: "EWS" },
    }],
  ])("scans forbidden exact tokens in event %s", (_label, event) => {
    const root = initRepo();
    addForecast(root);
    commitAll(root, "add forecast");
    markBase(root);
    appendEvents(root, [event]);
    commitAll(root, "append public event copy");
    expectFail(root, /forbidden token.*EWS/i);
  });

  it("scans metadata correction before/after string values", () => {
    const root = initRepo();
    addVision(root, "future-map-a");
    commitAll(root, "add vision");
    markBase(root);
    const manifest = readJson(root, "content/future-atlas/manifest.json");
    manifest.entries[0].authorDisplay = "EWS";
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    appendEvents(root, [{
      type: "metadata_correction", eventId: "ev-meta", date: "2026-07-18", articleId: "future-map-a",
      field: "authorDisplay", before: "田平茂樹", after: "EWS", reason: "表示訂正", materials: [],
    }]);
    commitAll(root, "change public author display");
    expectFail(root, /forbidden token.*EWS/i);
  });

  it.each([
    ["futureAtlas namespace", (messages) => { messages.futureAtlas.heading = "EWS"; }],
    ["nav.futureAtlas", (messages) => { messages.nav.futureAtlas = "EWS"; }],
    ["home.family.future-map", (messages) => { messages.home.family["future-map"] = "EWS"; }],
    ["articles.family.future-map", (messages) => { messages.articles.family["future-map"] = "EWS"; }],
  ])("scans %s", (_label, mutate) => {
    const root = initRepo();
    const messages = safeMessages();
    mutate(messages);
    writeJson(root, "messages/ja.json", messages);
    commitAll(root, "change UI copy");
    expectFail(root, /forbidden token.*EWS/i);
  });

  it("allows the public term 先行指標", () => {
    const root = initRepo();
    addVision(root, "future-map-a", "vision", "ai", { ja: "先行指標を観測する" });
    commitAll(root, "add allowed copy");
    expectPass(root);
  });

  it("also scans the existing public-ops forbidden vocabulary", () => {
    const root = initRepo();
    writeJson(root, "scripts/migrate-articles/forbidden-terms.json", {
      allowedPublicLabels: [],
      designTerms: [],
      opsTerms: ["draft"],
      bodyExemptTerms: [],
    });
    addVision(root, "future-map-a", "vision", "ai", { ja: "draft のまま公開" });
    commitAll(root, "add existing forbidden public term");
    expectFail(root, /forbidden public term.*draft/i);
  });

  it.each([
    ["deletion", (tokens) => tokens.slice(1)],
    ["modification", (tokens) => ["CHANGED", ...tokens.slice(1)]],
    ["middle insertion", (tokens) => [tokens[0], "NEW", ...tokens.slice(1)]],
  ])("rejects vocabulary prefix %s", (_label, mutate) => {
    const root = initRepo();
    const vocabulary = readJson(root, "content/future-atlas/vocabulary.json");
    vocabulary.forbiddenExactTokens = mutate(vocabulary.forbiddenExactTokens);
    writeJson(root, "content/future-atlas/vocabulary.json", vocabulary);
    commitAll(root, "mutate vocabulary history");
    expectFail(root, /vocabulary.*append-only prefix/i);
  });

  it("accepts vocabulary tail append", () => {
    const root = initRepo();
    const vocabulary = readJson(root, "content/future-atlas/vocabulary.json");
    vocabulary.forbiddenExactTokens.push("New Internal Token");
    writeJson(root, "content/future-atlas/vocabulary.json", vocabulary);
    commitAll(root, "append vocabulary");
    expectPass(root);
  });

  it("rejects overlap between allowed and forbidden terms", () => {
    const root = initRepo();
    const vocabulary = readJson(root, "content/future-atlas/vocabulary.json");
    vocabulary.forbiddenExactTokens.push("先行指標");
    writeJson(root, "content/future-atlas/vocabulary.json", vocabulary);
    commitAll(root, "create vocabulary overlap");
    expectFail(root, /allowedPublicTerms.*forbiddenExactTokens.*overlap/i);
  });

  it("blocks surfacePublished false to true below the seven publication thresholds", () => {
    const root = initRepo();
    writeJson(root, "content/future-atlas/config.json", { schemaVersion: 1, surfacePublished: true });
    commitAll(root, "publish empty surface");
    expectFail(root, /publish threshold/i);
  });

  it("does not count empty declared shelves toward the three-theme publication threshold", () => {
    const root = initRepo();
    addVision(root, "vision-1", "vision", "ai");
    addVision(root, "vision-2", "vision", "ai");
    addVision(root, "report-1", "structural_report", "ai");
    addVision(root, "report-2", "structural_report", "ai");
    addForecast(root, "fc-1", "forecast-1", { theme: "ai" });
    addForecast(root, "fc-2", "forecast-2", { theme: "ai" });
    const manifest = readJson(root, "content/future-atlas/manifest.json");
    ensureTheme(manifest, "finance");
    ensureTheme(manifest, "energy");
    writeJson(root, "content/future-atlas/manifest.json", manifest);
    writeJson(root, "content/future-atlas/config.json", { schemaVersion: 1, surfacePublished: true });
    commitAll(root, "publish with empty declared shelves");
    expectFail(root, /publish threshold.*themes=1\/3/i);
  });

  it("accepts surface publication after all content thresholds are met", () => {
    const root = initRepo();
    addVision(root, "vision-1", "vision", "ai");
    addVision(root, "vision-2", "vision", "finance");
    addVision(root, "report-1", "structural_report", "energy");
    addVision(root, "report-2", "structural_report", "ai");
    addForecast(root, "fc-1", "forecast-1", { theme: "finance" });
    addForecast(root, "fc-2", "forecast-2", { theme: "energy" });
    writeJson(root, "content/future-atlas/config.json", { schemaVersion: 1, surfacePublished: true });
    commitAll(root, "publish complete atlas");
    expectPass(root);
  });
});

describe("future-atlas GitHub workflow", () => {
  it("runs the full-history guard job on pull requests to main", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    expect(workflow).toContain("name: future-atlas-guards");
    expect(workflow).toMatch(/pull_request:[\s\S]*branches:\s*\[main\]/);
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("node scripts/future-atlas/gate.mjs --base");
  });
});
