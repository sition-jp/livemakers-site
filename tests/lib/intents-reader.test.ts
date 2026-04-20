// tests/lib/intents-reader.test.ts
import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import {
  resolveIntentsPath,
  readAndParseIntents,
  collapseLatestIntentById,
} from "@/lib/intents-reader";

const FIXTURE_DIR = path.join(__dirname, "../fixtures/intents");

describe("lib/intents-reader — resolveIntentsPath", () => {
  const origEnv = process.env.LM_INTENTS_JSONL_PATH;
  afterEach(() => {
    if (origEnv === undefined) delete process.env.LM_INTENTS_JSONL_PATH;
    else process.env.LM_INTENTS_JSONL_PATH = origEnv;
  });

  it("IR-1a: returns LM_INTENTS_JSONL_PATH env var when set", () => {
    process.env.LM_INTENTS_JSONL_PATH = "/custom/path/tradeintents.jsonl";
    expect(resolveIntentsPath()).toBe("/custom/path/tradeintents.jsonl");
  });

  it("IR-1b: falls back to repo-local default when env var unset", () => {
    delete process.env.LM_INTENTS_JSONL_PATH;
    const p = resolveIntentsPath();
    expect(p).toContain("data/tradeintents.jsonl");
  });
});

describe("lib/intents-reader — readAndParseIntents", () => {
  it("IR-2: parses valid fixture with 2 distinct ids", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { intents, parseErrors, fileExists } = readAndParseIntents(p);
    expect(fileExists).toBe(true);
    expect(parseErrors).toEqual([]);
    expect(intents).toHaveLength(2);
    expect(intents.map((i) => i.intent_id).sort()).toEqual([
      "int_0000000000000001",
      "int_0000000000000002",
    ]);
  });

  it("IR-3: missing file returns empty + fileExists=false", () => {
    const p = path.join(FIXTURE_DIR, "does-not-exist.jsonl");
    const r = readAndParseIntents(p);
    expect(r.fileExists).toBe(false);
    expect(r.intents).toEqual([]);
    expect(r.mtimeMs).toBeNull();
  });

  it("IR-4: invalid JSON line: skipped + recorded in parseErrors", () => {
    const p = path.join(FIXTURE_DIR, "invalid-json.jsonl");
    const { intents, parseErrors } = readAndParseIntents(p);
    expect(intents).toHaveLength(1);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].lineNumber).toBe(2);
  });

  it("IR-5: schema-violation line: skipped + recorded in parseErrors", () => {
    const p = path.join(FIXTURE_DIR, "schema-violation.jsonl");
    const { intents, parseErrors } = readAndParseIntents(p);
    expect(intents).toHaveLength(1);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].lineNumber).toBe(2);
  });

  it("IR-6: returns mtimeMs for real file", () => {
    const p = path.join(FIXTURE_DIR, "valid.jsonl");
    const { mtimeMs } = readAndParseIntents(p);
    expect(mtimeMs).toBeGreaterThan(0);
  });
});

describe("lib/intents-reader — collapseLatestIntentById", () => {
  it("IR-7: collapses same-id entries to the latest updated_at", () => {
    const p = path.join(FIXTURE_DIR, "latest-wins.jsonl");
    const { intents } = readAndParseIntents(p);
    // raw read returns both rows
    expect(intents).toHaveLength(2);
    const collapsed = collapseLatestIntentById(intents);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].title).toBe("new");
    expect(collapsed[0].thesis_conviction).toBe(0.8);
  });

  it("IR-8: empty input returns empty output", () => {
    expect(collapseLatestIntentById([])).toEqual([]);
  });
});
