/**
 * TradeIntents reader — file → TradeIntent[] transform.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §2.4 / §5.4
 *
 * Mirrors lib/signals-reader.ts design:
 * - File absence returns empty + fileExists=false (not exception)
 * - Per-line JSON / zod failures are skipped and recorded in parseErrors
 * - Latest-row-wins collapse applied via collapseLatestIntentById helper
 *
 * SSOT builders (buildIntentListResponse / buildIntentDetailResponse) are
 * added in Task A3 on top of this reader.
 */
import fs from "fs";
import path from "path";
import { TradeIntentSchema, type TradeIntent } from "./intents";

export interface IntentsReadResult {
  intents: TradeIntent[];
  parseErrors: Array<{ lineNumber: number; error: string }>;
  fileExists: boolean;
  mtimeMs: number | null;
}

export function resolveIntentsPath(): string {
  const env = process.env.LM_INTENTS_JSONL_PATH;
  if (env && env.trim() !== "") return env;
  return path.resolve(process.cwd(), "data/tradeintents.jsonl");
}

export function readAndParseIntents(jsonlPath: string): IntentsReadResult {
  if (!fs.existsSync(jsonlPath)) {
    return { intents: [], parseErrors: [], fileExists: false, mtimeMs: null };
  }
  const stat = fs.statSync(jsonlPath);
  const text = fs.readFileSync(jsonlPath, "utf-8");
  const intents: TradeIntent[] = [];
  const parseErrors: Array<{ lineNumber: number; error: string }> = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(line);
    } catch (e) {
      parseErrors.push({
        lineNumber: i + 1,
        error: `json parse: ${(e as Error).message}`,
      });
      continue;
    }
    const result = TradeIntentSchema.safeParse(payload);
    if (!result.success) {
      parseErrors.push({
        lineNumber: i + 1,
        error: `zod: ${result.error.issues.map((x) => x.message).join("; ")}`,
      });
      continue;
    }
    intents.push(result.data);
  }
  return {
    intents,
    parseErrors,
    fileExists: true,
    mtimeMs: stat.mtimeMs,
  };
}

export function collapseLatestIntentById(
  rows: TradeIntent[]
): TradeIntent[] {
  const byId = new Map<string, TradeIntent>();
  for (const row of rows) {
    const prev = byId.get(row.intent_id);
    if (!prev || row.updated_at > prev.updated_at) {
      byId.set(row.intent_id, row);
    }
  }
  return Array.from(byId.values());
}
