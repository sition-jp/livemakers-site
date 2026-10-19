import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { scanText } from "../../scripts/public-leak/rules.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_DIR, "../..");
const GATE_PATH = path.join(PROJECT_ROOT, "scripts/public-leak/gate.mjs");
const WORKFLOW_PATH = path.join(PROJECT_ROOT, ".github/workflows/future-atlas-guards.yml");

const HOME_PATH = ["", "Users", "someone", "Documents", "x.md"].join("/");
const MEMORY_FILE = ["project", "internal_plan.md"].join("_");
const PRIVATE_REPO = ["sition", "core"].join("-");

const roots = [];

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const writeText = (root, relativePath, text) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};

const makeRepo = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "public-leak-gate-"));
  roots.push(root);
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  writeText(root, "content/brief/a/ja.md", "clean body\n");
  writeText(root, "lib/a.ts", "export const a = 1;\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "base"]);
  git(root, ["checkout", "-q", "-b", "change"]);
  return root;
};

const commitAll = (root) => {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "change"]);
};

const runGate = (root, args = ["--base", "main"]) =>
  spawnSync(process.execPath, [GATE_PATH, ...args], { cwd: root, encoding: "utf8" });

afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop(), { recursive: true, force: true });
});

describe("public-leak rules", () => {
  it("flags every rule on public-surface files", () => {
    const text = [
      `see ${HOME_PATH}`,
      `per ${MEMORY_FILE}`,
      "per CLAUDE.md",
      `from ${PRIVATE_REPO}`,
      "under 08_DOCS/knowledge",
      "token in secrets.env",
    ].join("\n");
    const rules = scanText("content/brief/x/ja.md", text).map((finding) => finding.rule);
    expect(rules).toEqual([
      "local-home-path",
      "memory-file",
      "agent-instructions",
      "private-repo",
      "internal-dir",
      "secret-location",
    ]);
  });

  it("applies only path and memory rules outside the public surface", () => {
    const text = [`see ${HOME_PATH}`, `per ${MEMORY_FILE}`, `from ${PRIVATE_REPO}`, "CLAUDE.md"].join("\n");
    const rules = scanText("lib/x.ts", text).map((finding) => finding.rule);
    expect(rules).toEqual(["local-home-path", "memory-file"]);
  });

  it("does not flag ordinary article words", () => {
    const text = "SITION の仮説と Cardano 公式の主題が一致した。sipo.tokyo / user_id / project-plan.md";
    expect(scanText("content/articles/x/ja.md", text)).toEqual([]);
  });

  it("honours the allow marker", () => {
    expect(scanText("content/x.md", `${HOME_PATH} <!-- public-leak-allow -->`)).toEqual([]);
  });
});

describe("public-leak gate", () => {
  it("passes a clean change", () => {
    const root = makeRepo();
    writeText(root, "content/brief/b/ja.md", "new clean brief\n");
    commitAll(root);
    const result = runGate(root);
    expect(result.status, result.stderr).toBe(0);
  });

  it("fails when a public-surface file names a private repository", () => {
    const root = makeRepo();
    writeText(root, "content/brief/a/ja.md", `clean body\nsource: ${PRIVATE_REPO}\n`);
    commitAll(root);
    const result = runGate(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("content/brief/a/ja.md:2");
    expect(result.stderr).toContain("[private-repo]");
  });

  it("fails on an added local path in code but ignores pre-existing lines", () => {
    const root = makeRepo();
    writeText(root, "lib/old.ts", `// ${HOME_PATH}\n`);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-q", "-m", "pre-existing"]);
    git(root, ["branch", "-f", "main", "HEAD"]);
    writeText(root, "lib/old.ts", `// ${HOME_PATH}\nexport const b = 2;\n`);
    commitAll(root);
    expect(runGate(root).status).toBe(0);

    writeText(root, "lib/new.ts", `const p = "${HOME_PATH}";\n`);
    commitAll(root);
    const result = runGate(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("lib/new.ts:1");
    expect(result.stderr).toContain("[local-home-path]");
  });

  it("does not apply public-surface-only rules to code", () => {
    const root = makeRepo();
    writeText(root, "lib/b.ts", `// produced by ${PRIVATE_REPO}\n`);
    commitAll(root);
    expect(runGate(root).status).toBe(0);
  });

  it("audits every tracked public-surface file with --all", () => {
    const root = makeRepo();
    writeText(root, "public/data/x.json", `{"note":"${MEMORY_FILE}"}\n`);
    commitAll(root);
    const result = runGate(root, ["--all"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("public/data/x.json:1");
  });
});

describe("public-leak gate wiring", () => {
  it("runs in the required guards job", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    expect(workflow).toContain("node scripts/public-leak/gate.mjs --base");
  });

  it("finds nothing in the current public surface", () => {
    const result = spawnSync(process.execPath, [GATE_PATH, "--all"], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
  });
});
