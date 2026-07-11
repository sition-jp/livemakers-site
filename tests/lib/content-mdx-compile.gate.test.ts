import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import {
  getAllArticles,
  getArticleBody,
} from "@/lib/articles/article-model";

const CONCURRENCY = 8;

describe("content MDX compile gate (all files, no sampling)", () => {
  it("compiles every ja/en body; failures name the slug", async () => {
    const queue = [...getAllArticles()];
    const failures: string[] = [];
    async function worker() {
      for (let article = queue.shift(); article; article = queue.shift()) {
        for (const locale of ["ja", "en"] as const) {
          try {
            await compile(getArticleBody(article.articleId, locale), {
              remarkPlugins: [remarkGfm],
            });
          } catch (error) {
            failures.push(
              `${article.articleId} [${locale}]: ${(error as Error).message}`,
            );
          }
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    expect(failures).toEqual([]);
  });
});
