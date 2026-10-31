#!/usr/bin/env node
/**
 * YouTube 動画の台本 (livemakers-youtube の episodes/<id>/script.yaml) から、
 * 動画の詳細記事に載せる出典の全件を content/videos/<slug>/sources.json へ
 * 書き出す。出典の正本は台本で、サイトの JSON はその写し。台本の出典を
 * 直したら、このスクリプトを流し直す。
 *
 *   node scripts/videos/sync-sources.mjs <script.yaml> <slug>
 *
 * 各出典には、それを最初に引いた章の番号 (1 始まり) を付ける。記事では
 * 章ごとにまとめて並べる。YAML の読み込みには台本側 repo の `yaml`
 * (livemakers-youtube の直接依存) を使い、このサイトには依存を足さない。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [scriptPath, slug] = process.argv.slice(2);
if (!scriptPath || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("usage: node scripts/videos/sync-sources.mjs <script.yaml> <slug>");
  process.exit(2);
}

const requireFromScript = createRequire(path.resolve(scriptPath));
const YAML = requireFromScript("yaml");
const script = YAML.parse(fs.readFileSync(scriptPath, "utf8"));

const firstChapter = new Map();
script.chapters.forEach((chapter, index) => {
  for (const paragraph of chapter.paragraphs ?? []) {
    for (const key of paragraph.sources ?? []) {
      if (!firstChapter.has(key)) firstChapter.set(key, index + 1);
    }
  }
});

const sources = Object.entries(script.sources).map(([key, source]) => {
  const chapter = firstChapter.get(key);
  if (!chapter) throw new Error(`source is never cited: ${key}`);
  return {
    key,
    title: source.title,
    url: source.url,
    accessed: String(source.accessed),
    chapter,
  };
});
for (const key of firstChapter.keys()) {
  if (!(key in script.sources)) throw new Error(`cited source is not defined: ${key}`);
}

const outPath = path.join(process.cwd(), "content", "videos", slug, "sources.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `${JSON.stringify({ episodeId: script.id, sources }, null, 2)}\n`,
);
console.log(`${outPath}: ${sources.length} sources from ${script.id}`);
