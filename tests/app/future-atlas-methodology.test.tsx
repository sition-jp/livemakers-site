import fs from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import { getMethodologyBody } from "@/app/[locale]/future-atlas/methodology/page";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("Future Atlas methodology route", () => {
  it.each(["ja", "en"] as const)("compiles the %s route body with the locked h1", async (locale) => {
    const source = getMethodologyBody(locale);
    const { content } = await compileMDX({
      source,
      options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
    });

    const html = renderToStaticMarkup(content);
    expect(html).toContain("<h1>未来予測の作法</h1>");
  });

  it("is ISR-backed and independent of surfacePublished", () => {
    const source = read("app/[locale]/future-atlas/methodology/page.tsx");
    expect(source).toContain("export const revalidate = 300");
    expect(source).toContain("MDXRemote");
    expect(source).toContain("remarkGfm");
    expect(source).not.toContain("surfacePublished");
    expect(source).not.toContain("notFound");
  });

  it("contains no implementation memo from the CP copy", () => {
    const body = getMethodologyBody("ja");
    expect(body).not.toContain("実装メモ");
    expect(body).not.toContain("正本規定を読者語化");
  });
});
