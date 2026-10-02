import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SESSIONS_FIXTURE_DIR_ENV_KEY,
  getAllSessionRecords,
} from "@/lib/sessions/session-content";

const MOCK_ID = "2026-07-10-asia-open";
const original = process.env[SESSIONS_FIXTURE_DIR_ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[SESSIONS_FIXTURE_DIR_ENV_KEY];
  else process.env[SESSIONS_FIXTURE_DIR_ENV_KEY] = original;
});

describe("session fixture dir (spec 2026-10-02 D13)", () => {
  it("the 7/10 layout mock is not in the public content dir", () => {
    expect(fs.existsSync(path.join(process.cwd(), "content", "sessions", MOCK_ID))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "tests", "fixtures", "sessions", MOCK_ID, "meta.json"))).toBe(true);
  });

  it("production (env unset) does not load the mock", () => {
    delete process.env[SESSIONS_FIXTURE_DIR_ENV_KEY];
    expect(getAllSessionRecords().some((record) => record.sessionId === MOCK_ID)).toBe(false);
  });

  it("tests (env set by tests/setup.ts) still load the mock", () => {
    process.env[SESSIONS_FIXTURE_DIR_ENV_KEY] = path.join(process.cwd(), "tests", "fixtures", "sessions");
    expect(getAllSessionRecords().some((record) => record.sessionId === MOCK_ID)).toBe(true);
  });
});
