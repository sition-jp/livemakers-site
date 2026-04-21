import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  readTouches,
  recordSkip,
  recordSeen,
  type TouchStore,
} from "@/lib/proposer/review-gate-touches";

let touchPath: string;

beforeEach(() => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "touch-"));
  touchPath = path.join(tmpDir, "review-gate-touches.json");
});

describe("review-gate-touches side-store", () => {
  it("readTouches returns {} when file missing", () => {
    expect(readTouches(touchPath)).toEqual({});
  });

  it("readTouches returns {} when file malformed", () => {
    fs.writeFileSync(touchPath, "not json");
    expect(readTouches(touchPath)).toEqual({});
  });

  it("recordSeen updates last_seen_at timestamp, skip_count=0 default", () => {
    recordSeen(touchPath, "int_1", "2026-04-22T05:15:00Z");
    const t = readTouches(touchPath);
    expect(t.int_1.last_seen_at).toBe("2026-04-22T05:15:00Z");
    expect(t.int_1.skip_count).toBe(0);
  });

  it("recordSkip increments skip_count + updates last_seen_at", () => {
    recordSkip(touchPath, "int_1", "2026-04-22T05:15:00Z");
    recordSkip(touchPath, "int_1", "2026-04-23T05:15:00Z");
    const t = readTouches(touchPath);
    expect(t.int_1.skip_count).toBe(2);
    expect(t.int_1.last_seen_at).toBe("2026-04-23T05:15:00Z");
  });

  it("recordSeen after recordSkip preserves skip_count", () => {
    recordSkip(touchPath, "int_1", "2026-04-22T05:15:00Z");
    recordSeen(touchPath, "int_1", "2026-04-22T05:20:00Z");
    const t = readTouches(touchPath);
    expect(t.int_1.skip_count).toBe(1);
    expect(t.int_1.last_seen_at).toBe("2026-04-22T05:20:00Z");
  });

  it("multiple intent_ids tracked independently", () => {
    recordSkip(touchPath, "int_1", "2026-04-22T05:15:00Z");
    recordSeen(touchPath, "int_2", "2026-04-22T05:15:00Z");
    const t = readTouches(touchPath);
    expect(t.int_1.skip_count).toBe(1);
    expect(t.int_2.skip_count).toBe(0);
  });
});
