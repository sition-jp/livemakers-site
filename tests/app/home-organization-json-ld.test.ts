import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

/**
 * G3 (2026-09-11 田平氏 GO): トップページに Organization + WebSite JSON-LD
 * を埋め込んでいることのソース検証。ビルダー本体のフィールド検証は
 * `tests/lib/organization-json-ld.test.ts` が担うので、ここでは「実際に
 * ホームページがそれを描画に使っているか」だけを見る (renderFullPage の
 * 大掛かりな mock harness を新規テストのためだけに複製しない)。
 */
describe("home page Organization/WebSite JSON-LD wiring", () => {
  it("imports and renders OrganizationJsonLd", () => {
    const source = read("app/[locale]/page.tsx");
    expect(source).toContain('import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd"');
    expect(source).toContain("<OrganizationJsonLd />");
  });
});
