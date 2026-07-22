import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  SERIES_SLUGS,
  getAllArticles,
} from "@/lib/articles/article-model";
import { isAllowedPublishedArticleRoute } from "@/lib/livemakers-terminal-preview/public-topology";

const TEST_CONTENT_DIR = path.join(process.cwd(), "tests", "fixtures", "content", "articles");

const read = (filePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), filePath), "utf8");

describe("articles routes (G41)", () => {
  it("article detail uses the shared public inflow boundary without direct fetching", () => {
    const source = read("app/[locale]/articles/[slug]/page.tsx");
    expect(source).toContain("loadPublicArticleInflowDetail");
    expect(source).not.toMatch(/fetch\(|useSWR|\/api\//);
    expect(source).toContain("generateStaticParams");
  });

  it("today and series use one public catalog and series rejects unknown slugs", () => {
    expect(read("app/[locale]/articles/today/page.tsx")).toContain(
      "loadPublicArticleInflowCatalog",
    );
    const series = read("app/[locale]/articles/series/[series]/page.tsx");
    expect(series).toContain("loadPublicArticleInflowCatalog");
    expect(series).toContain("SERIES_SLUGS");
    expect(series).toContain("notFound");
  });

  it("keeps every public article route free of direct feed fetches", () => {
    for (const route of [
      "app/[locale]/articles/[slug]/page.tsx",
      "app/[locale]/articles/today/page.tsx",
      "app/[locale]/articles/series/[series]/page.tsx",
    ]) {
      expect(read(route)).not.toMatch(/fetch\(|useSWR|\/api\//);
    }
  });

  it("every fixture and series href passes the route ledger", () => {
    for (const article of getAllArticles({ contentDir: TEST_CONTENT_DIR })) {
      expect(isAllowedPublishedArticleRoute(article.href), article.href).toBe(
        true,
      );
    }
    for (const series of SERIES_SLUGS) {
      const href = `/articles/series/${series}`;
      expect(isAllowedPublishedArticleRoute(href), href).toBe(true);
    }
  });
});
