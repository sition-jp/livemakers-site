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
import type { Signal } from "./signals";

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
  // Try to stat/read directly. ENOENT → empty + fileExists=false (the file
  // hasn't been written yet by the authoring pipeline, which is a legitimate
  // state, not an error). All other errors (ENOTDIR, EACCES, EIO, etc.)
  // propagate so the route layer can map them to 503.
  let stat: fs.Stats;
  let text: string;
  try {
    stat = fs.statSync(jsonlPath);
    text = fs.readFileSync(jsonlPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { intents: [], parseErrors: [], fileExists: false, mtimeMs: null };
    }
    throw err;
  }
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

/**
 * Collapse same-id rows to the latest-seen by `updated_at`.
 *
 * Tie-break: on identical `updated_at`, **last row in input wins** (matches
 * append-only jsonl semantics — the physically later row is considered the
 * newer state). This aligns with Task 1-3's signals-reader `collapseLatestById`
 * last-write-wins policy.
 */
export function collapseLatestIntentById(
  rows: TradeIntent[]
): TradeIntent[] {
  const byId = new Map<string, TradeIntent>();
  for (const row of rows) {
    const prev = byId.get(row.intent_id);
    if (!prev || row.updated_at >= prev.updated_at) {
      byId.set(row.intent_id, row);
    }
  }
  return Array.from(byId.values());
}

export type TradeIntentSummary = Pick<
  TradeIntent,
  | "intent_id"
  | "trace_id"
  | "schema_version"
  | "status"
  | "side"
  | "target_assets"
  | "preferred_horizon"
  | "priority"
  | "thesis_conviction"
  | "execution_confidence"
  | "created_at"
  | "updated_at"
> & {
  display: TradeIntent["display"];
  source_signal_ids: string[];
};

export interface IntentListResponse {
  intents: TradeIntentSummary[];
  meta: {
    count: number;
    source_freshness_sec: number;
  };
}

export interface IntentDetailResponse {
  intent: TradeIntent | null;
  status: "ok" | "not_found";
  source_signals: Signal[];
  source_signals_missing: string[];
  meta: {
    found: boolean;
    source_freshness_sec: number;
  };
}

function toSummary(i: TradeIntent): TradeIntentSummary {
  return {
    intent_id: i.intent_id,
    trace_id: i.trace_id,
    schema_version: i.schema_version,
    status: i.status,
    side: i.side,
    target_assets: i.target_assets,
    preferred_horizon: i.preferred_horizon,
    priority: i.priority,
    thesis_conviction: i.thesis_conviction,
    execution_confidence: i.execution_confidence,
    created_at: i.created_at,
    updated_at: i.updated_at,
    display: i.display,
    source_signal_ids: i.source_signal_ids,
  };
}

export function buildIntentListResponse(
  intents: TradeIntent[],
  source_freshness_sec: number,
): IntentListResponse {
  const publicOnly = intents.filter((i) => i.visibility === "public");
  const sorted = [...publicOnly].sort((a, b) =>
    a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0,
  );
  return {
    intents: sorted.map(toSummary),
    meta: { count: sorted.length, source_freshness_sec },
  };
}

export function buildIntentDetailResponse(
  intents: TradeIntent[],
  allSignals: Signal[],
  id: string,
  source_freshness_sec: number,
): IntentDetailResponse {
  const intent = intents.find((i) => i.intent_id === id) ?? null;
  if (!intent) {
    return {
      intent: null,
      status: "not_found",
      source_signals: [],
      source_signals_missing: [],
      meta: { found: false, source_freshness_sec },
    };
  }
  const sigMap = new Map(allSignals.map((s) => [s.id, s]));
  const source_signals: Signal[] = [];
  const source_signals_missing: string[] = [];
  for (const sid of intent.source_signal_ids) {
    const s = sigMap.get(sid);
    if (s) source_signals.push(s);
    else source_signals_missing.push(sid);
  }
  return {
    intent,
    status: "ok",
    source_signals,
    source_signals_missing,
    meta: { found: true, source_freshness_sec },
  };
}

export function buildReferencingIntentIds(
  intents: TradeIntent[],
  signalId: string,
): string[] {
  return intents
    .filter((i) => i.source_signal_ids.includes(signalId))
    .map((i) => i.intent_id);
}

export interface InvariantBreach {
  intent_id: string;
  rule: string;
  detail: string;
}

export function flagInvariantBreaches(
  intents: TradeIntent[],
): InvariantBreach[] {
  const out: InvariantBreach[] = [];
  for (const i of intents) {
    if (i.updated_at < i.created_at) {
      out.push({
        intent_id: i.intent_id,
        rule: "updated_at>=created_at",
        detail: `updated_at=${i.updated_at} < created_at=${i.created_at}`,
      });
    }
    if (i.human_review.approved_at < i.created_at) {
      out.push({
        intent_id: i.intent_id,
        rule: "approved_at>=created_at",
        detail: `approved_at=${i.human_review.approved_at} < created_at=${i.created_at}`,
      });
    }
    if (i.expires_at && i.expires_at <= i.created_at) {
      out.push({
        intent_id: i.intent_id,
        rule: "expires_at>created_at",
        detail: `expires_at=${i.expires_at} <= created_at=${i.created_at}`,
      });
    }
  }
  return out;
}
