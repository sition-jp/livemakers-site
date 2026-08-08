import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isAllowedPublishedArticleRoute } from "@/lib/livemakers-terminal-preview/public-topology";
import { getAllSessionRecords } from "@/lib/sessions/session-content";

const read = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

describe("session routes (G-a lifecycle)", () => {
  it("renders live view or crystallized article at the same URL", () => {
    const source = read("app/[locale]/sessions/[slug]/page.tsx");
    expect(source).toContain("findSessionRecord");
    expect(source).toContain('articleStatus === "published"');
    expect(source).toContain('locale === "ja"');
    expect(source).toContain("SessionPendingView");
    expect(source).toContain("resolveSessionPageRecord");
    expect(source).toContain("bodyJa");
    expect(source).not.toMatch(/fetch\(|useSWR|\/api\//);
    expect(source).not.toMatch(/try\s*\{|catch\s*\{/);
  });

  it("archive lists only crystallized sessions", () => {
    const source = read("app/[locale]/sessions/archive/page.tsx");
    expect(source).toContain('articleStatus === "published"');
  });

  it("every session currentUrl passes the route ledger", () => {
    for (const record of getAllSessionRecords()) {
      expect(
        isAllowedPublishedArticleRoute(record.currentUrl),
        record.currentUrl,
      ).toBe(true);
    }
  });
});
