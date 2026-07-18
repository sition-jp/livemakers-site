import fs from "node:fs";
import path from "node:path";

import { MDXRemote } from "next-mdx-remote/rsc";
import { setRequestLocale } from "next-intl/server";
import remarkGfm from "remark-gfm";

export const revalidate = 300;

const METHODOLOGY_DIR = path.join(
  process.cwd(),
  "content",
  "future-atlas",
  "methodology",
);

export function getMethodologyBody(locale: "ja" | "en"): string {
  const localizedPath = path.join(METHODOLOGY_DIR, `${locale}.md`);
  const fallbackPath = path.join(METHODOLOGY_DIR, "ja.md");

  return fs.readFileSync(
    fs.existsSync(localizedPath) ? localizedPath : fallbackPath,
    "utf8",
  );
}

export default async function FutureAtlasMethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 lg:py-24">
      <div className="prose prose-zinc max-w-none dark:prose-invert">
        <MDXRemote
          source={getMethodologyBody(locale === "en" ? "en" : "ja")}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        />
      </div>
    </article>
  );
}
