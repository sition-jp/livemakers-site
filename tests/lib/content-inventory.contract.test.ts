import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAllArticles } from "@/lib/articles/article-model";

describe("content inventory contract", () => {
  const contentDir = path.join(process.cwd(), "content", "articles");
  const articles = getAllArticles();

  it("parses every directory and keeps hrefs canonical", () => {
    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expect(article.href).toBe(`/articles/${article.articleId}`);
    }
  });

  it("has no duplicate articleIds", () => {
    const ids = articles.map((article) => article.articleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains only well-formed article directories", () => {
    for (const entry of fs.readdirSync(contentDir, { withFileTypes: true })) {
      expect(entry.isDirectory(), `stray file: ${entry.name}`).toBe(true);
      const files = fs.readdirSync(path.join(contentDir, entry.name));
      expect(files).toContain("meta.json");
      expect(files).toContain("ja.md");
      for (const file of files) {
        expect(
          ["meta.json", "ja.md", "en.md"],
          `disallowed file ${entry.name}/${file}`,
        ).toContain(file);
      }
      const ja = fs.readFileSync(
        path.join(contentDir, entry.name, "ja.md"),
        "utf8",
      );
      expect(ja.trim().length, `empty ja.md: ${entry.name}`).toBeGreaterThan(0);
    }
  });
});
