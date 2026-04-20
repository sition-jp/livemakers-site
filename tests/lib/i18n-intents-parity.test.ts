import { describe, it, expect } from "vitest";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";

function collectKeys(obj: any, prefix = ""): string[] {
  const keys: string[] = [];
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const k of Object.keys(obj)) {
      const nested = collectKeys(obj[k], prefix ? `${prefix}.${k}` : k);
      if (nested.length === 0) {
        keys.push(prefix ? `${prefix}.${k}` : k);
      } else {
        keys.push(...nested);
      }
    }
  } else {
    keys.push(prefix);
  }
  return keys;
}

describe("i18n intents namespace parity", () => {
  it("I18N-1: intents.* keys identical in en.json and ja.json", () => {
    const en = collectKeys((enMessages as any).intents ?? {}, "intents");
    const ja = collectKeys((jaMessages as any).intents ?? {}, "intents");
    expect(en.sort()).toEqual(ja.sort());
    expect(en.length).toBeGreaterThan(30);
  });

  it("I18N-2: disclaimer body contains LiveMakers Terminal in both locales", () => {
    expect((enMessages as any).intents.disclaimer.body).toContain(
      "LiveMakers Terminal",
    );
    expect((jaMessages as any).intents.disclaimer.body).toContain(
      "LiveMakers Terminal",
    );
  });

  it("I18N-3: signals.detail.referenced_by_intents.title exists in both", () => {
    expect(
      (enMessages as any).signals.detail.referenced_by_intents.title,
    ).toBeTruthy();
    expect(
      (jaMessages as any).signals.detail.referenced_by_intents.title,
    ).toBeTruthy();
  });
});
