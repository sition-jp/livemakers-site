import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { evidenceCopyKey, EVIDENCE_COPY_KEYS } from "@/lib/pivots/evidence-copy";

const catalog = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "lib", "pivots", "evidence-messages.json"), "utf-8"),
) as { messages: string[] };
const ja = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "ja.json"), "utf-8"));
const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "en.json"), "utf-8"));

describe("evidenceCopyKey", () => {
  test("every producer message maps to a key", () => {
    for (const m of catalog.messages) {
      const concrete = m.replace("{rsi}", "31.2");
      expect(evidenceCopyKey(concrete), concrete).not.toBeNull();
    }
  });
  test("RSI messages carry the numeric value", () => {
    expect(evidenceCopyKey("RSI is in oversold territory (28.7)")).toEqual({ key: "rsi_oversold", value: "28.7" });
    expect(evidenceCopyKey("RSI is in overheated territory (73.0)")).toEqual({ key: "rsi_overheated", value: "73.0" });
  });
  test("unknown message → null (UI falls back to the raw English)", () => {
    expect(evidenceCopyKey("Something new the producer might say")).toBeNull();
  });
  test("catalog size equals key count", () => {
    expect(catalog.messages.length).toBe(EVIDENCE_COPY_KEYS.length);
  });
  test("ja and en have text+meaning for every key", () => {
    for (const key of EVIDENCE_COPY_KEYS) {
      for (const [locale, bundle] of [["ja", ja], ["en", en]] as const) {
        const entry = bundle.turningPoints.evidenceCopy[key];
        expect(entry, `${locale}.turningPoints.evidenceCopy.${key}`).toBeDefined();
        expect(typeof entry.text).toBe("string");
        expect(typeof entry.meaning).toBe("string");
      }
    }
  });
});
