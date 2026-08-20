import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";

/**
 * i18n routing contract (2026-08-21 田平氏 GO: トップ=日本語固定).
 *
 * livemakers.com/ は日本語読者が全読者層なので、root は常に /ja へ。
 * 公開パイプライン (sub-repo) の canonical URL は
 * https://livemakers.com/ja/articles/... で固定されているため、
 * /ja 接頭辞を外す方向の変更 (defaultLocale=ja + as-needed) は禁止 —
 * localePrefix は "always" を維持して既公開 URL を不変に保つ。
 */
describe("i18n routing contract", () => {
  it("root serves Japanese: defaultLocale is ja", () => {
    expect(routing.defaultLocale).toBe("ja");
  });

  it("every URL keeps its locale prefix so /ja canonical URLs never change", () => {
    expect(routing.localePrefix).toBe("always");
  });

  it("locale is decided by URL only — no cookie / Accept-Language detection", () => {
    expect(routing.localeDetection).toBe(false);
  });
});
