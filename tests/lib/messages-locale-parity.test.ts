import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";

// next-intl throws MISSING_MESSAGE at render time when a locale lacks a key the
// other locale has (e.g. /en home crashed on home.sessionNow.freshnessPrefix).
// Key sets must stay identical so no locale can drift silently.
function flattenKeys(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) {
    return [prefix];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    flattenKeys(value, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("messages locale parity", () => {
  const jaKeys = new Set(flattenKeys(jaMessages));
  const enKeys = new Set(flattenKeys(enMessages));

  it("en.json has every key ja.json has", () => {
    const missingInEn = [...jaKeys].filter((key) => !enKeys.has(key)).sort();
    expect(missingInEn).toEqual([]);
  });

  it("ja.json has every key en.json has", () => {
    const missingInJa = [...enKeys].filter((key) => !jaKeys.has(key)).sort();
    expect(missingInJa).toEqual([]);
  });
});
