// scripts/sessions/strip-legacy-market-numbers.mjs
// 2026-10-02 田平氏決定 (spec 2026-10-02-livemakers-market-data-hyperliquid-design §4-4 / D4・D5):
// Yahoo / CoinGecko 時代のセッション記事から市場の数値を取り除く一回限りの変換。
// 対象 = observationStatus が absent でなく、asOfJst が CUTOFF (SDE runner 付け替え時刻) より前の記事。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LEGACY_NOTE =
  "この回は数値スナップショットのみの記録でした。データの出所を見直したため、数値の掲載を終了しました。";

const SNAPSHOT_HEADING = "## 数値スナップショット";
const TREND_BULLET = /^(?:- )?\S.* \S+ → \S+（[+-]?\d+(?:\.\d+)?%）$/;
const MOVERS_BULLET = /^(?:- )?変動幅上位: /;

export function isLegacyNumberBullet(text) {
  const line = text.trim();
  return TREND_BULLET.test(line) || MOVERS_BULLET.test(line);
}

export function stripBody(body) {
  const lines = body.split("\n");
  const kept = [];
  let inSnapshot = false;
  let removedSection = false;
  let removedBullets = 0;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      inSnapshot = line.trim() === SNAPSHOT_HEADING;
      if (inSnapshot) {
        removedSection = true;
        continue;
      }
    }
    if (inSnapshot) continue;
    if (isLegacyNumberBullet(line)) {
      removedBullets += 1;
      continue;
    }
    kept.push(line);
  }
  const hasContent = kept.some((line) => line.trim() !== "" && !line.startsWith("## "));
  if (!hasContent) {
    return { body: `${LEGACY_NOTE}\n`, removedSection, removedBullets, replacedWithNote: body.trim() !== LEGACY_NOTE };
  }
  const joined = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
  return {
    body: joined.endsWith("\n") ? joined : `${joined}\n`,
    removedSection,
    removedBullets,
    replacedWithNote: false,
  };
}

export function stripMeta(meta) {
  const next = structuredClone(meta);
  const before = next.bullets.length;
  next.bullets = next.bullets.filter((bullet) => !isLegacyNumberBullet(bullet));
  return { meta: next, removedBullets: before - next.bullets.length };
}

export function planSession(meta, cutoffIso) {
  if (meta.observationStatus === "absent") return "skip_absent";
  if (new Date(meta.asOfJst).getTime() >= new Date(cutoffIso).getTime()) return "skip_after_cutoff";
  return "convert";
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--content-dir") args.contentDir = argv[(i += 1)];
    else if (arg === "--cutoff") args.cutoff = argv[(i += 1)];
    else if (arg === "--dry-run") args.dryRun = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.contentDir || !args.cutoff) throw new Error("--content-dir and --cutoff are required");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/.test(args.cutoff)) {
    throw new Error("--cutoff must be a JST ISO timestamp like 2026-10-03T22:55:00+09:00");
  }
  return args;
}

export function run(argv) {
  const args = parseArgs(argv);
  const summary = {
    converted: 0, notes: 0, skippedAbsent: 0, skippedAfterCutoff: 0,
    removedBullets: 0, removedSections: 0, files: [],
  };
  for (const id of fs.readdirSync(args.contentDir).sort()) {
    const dir = path.join(args.contentDir, id);
    const metaPath = path.join(dir, "meta.json");
    if (!fs.statSync(dir).isDirectory() || !fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const decision = planSession(meta, args.cutoff);
    if (decision === "skip_absent") { summary.skippedAbsent += 1; continue; }
    if (decision === "skip_after_cutoff") { summary.skippedAfterCutoff += 1; continue; }
    const metaResult = stripMeta(meta);
    const bodyPath = path.join(dir, "ja.md");
    const bodyResult = fs.existsSync(bodyPath)
      ? stripBody(fs.readFileSync(bodyPath, "utf8"))
      : null;
    const changed =
      metaResult.removedBullets > 0 ||
      (bodyResult && (bodyResult.removedSection || bodyResult.removedBullets > 0 || bodyResult.replacedWithNote));
    if (!changed) continue;
    summary.converted += 1;
    summary.removedBullets += metaResult.removedBullets;
    if (bodyResult) {
      if (bodyResult.removedSection) summary.removedSections += 1;
      if (bodyResult.replacedWithNote) summary.notes += 1;
    }
    summary.files.push(id);
    if (!args.dryRun) {
      fs.writeFileSync(metaPath, `${JSON.stringify(metaResult.meta, null, 2)}\n`);
      if (bodyResult) fs.writeFileSync(bodyPath, bodyResult.body);
    }
  }
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summary = run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
