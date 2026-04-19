/**
 * Signals reader — file → Signal[] transform.
 *
 * Implements the §7.5 "Reader Contract" from the SDE signal-generator v0.1
 * design: read `signals.jsonl`, parse every line with zod, collapse same-id
 * entries to latest-row-wins, and expose both the resulting Signal[] and
 * diagnostics (mtime, parse errors, file existence) so the caller can assemble
 * HTTP response metadata and decide error-handling strategy.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-signals-api-and-card-ui-design.md §1.3 / §2.5
 * Parent: 08_DOCS/knowledge/specs/2026-04-18-signal-generator-v0.1-design.md §7.5
 *
 * Design decisions (spec §1.1 / §2.5):
 * - File absence returns empty + fileExists=false, NOT an exception. The API
 *   layer maps this to 200 + empty response — it's the expected state before
 *   SDE writes its first signal.
 * - Individual parse failures are skipped (silent drop forbidden). We log to
 *   stderr and return error count in `parseErrors` so callers can surface
 *   degraded state if they wish.
 * - The production jsonl uses explicit `null` for optional fields where the
 *   zod schema accepts `undefined`. We pre-normalize null → undefined at the
 *   reader boundary so signals.ts (source-of-truth schema) stays unchanged.
 */
import fs from "fs";
import path from "path";
import { SignalSchema, type Signal } from "./signals";

export interface ReadResult {
  signals: Signal[];
  parseErrors: Array<{ lineNumber: number; error: string }>;
  fileExists: boolean;
  mtimeMs: number | null;
}

/**
 * Resolve the signals.jsonl path. Env override > monorepo-relative default.
 *
 * The monorepo-relative default assumes cwd is the livemakers-site package
 * root (both `next dev` and `next build` run from this cwd). On Vercel the
 * full repo is checked out at the project root, so the same relative path
 * resolves correctly in both local dev and production.
 */
export function resolveSignalsPath(): string {
  const env = process.env.LM_SIGNALS_JSONL_PATH;
  if (env && env.trim() !== "") return env;
  return path.resolve(
    process.cwd(),
    "../../07_DATA/content/intelligence/signals.jsonl"
  );
}

/**
 * Normalize explicit `null` → `undefined` for optional fields before zod
 * parsing. The SDE Python writer serializes `Optional[T]` as JSON `null`,
 * but the committed zod schema (source of truth) declares these fields as
 * `.optional()` (undefined-only). Coercing here lets the reader consume
 * production data without modifying the schema contract.
 */
function coerceNullsToUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  // Only top-level optional fields per SignalSchema — nested evidence and
  // similar_cases items are required-shape (no optional inner fields with
  // nulls in practice) so we avoid deep traversal.
  const OPTIONAL_NULLABLE = new Set([
    "updated_at",
    "expires_at",
    "supersedes_signal_id",
    "conflict_group",
    "event_key",
    "position_hint",
    "primary_asset",
    "sipo_action",
    // audit_note and locked_fields are declared nullable().optional() in the
    // schema so null is actually accepted — but normalizing them keeps the
    // parsed Signal shape uniform downstream.
  ]);
  const out: Record<string, unknown> = { ...obj };
  for (const key of OPTIONAL_NULLABLE) {
    if (out[key] === null) delete out[key];
  }
  return out;
}

/**
 * Collapse a list of Signal objects to latest-row-wins by id.
 * Preserves insertion order via Map.
 */
export function collapseLatestById(signals: Signal[]): Signal[] {
  const latestById = new Map<string, Signal>();
  for (const s of signals) latestById.set(s.id, s);
  return [...latestById.values()];
}

/**
 * Read signals.jsonl and parse each line with zod.
 *
 * @returns ReadResult with collapsed signals (latest row wins), diagnostics.
 */
export function readAndParseSignals(jsonlPath: string): ReadResult {
  const parseErrors: Array<{ lineNumber: number; error: string }> = [];

  if (!fs.existsSync(jsonlPath)) {
    return { signals: [], parseErrors, fileExists: false, mtimeMs: null };
  }

  let raw: string;
  let mtimeMs: number | null = null;
  try {
    raw = fs.readFileSync(jsonlPath, "utf-8");
    const stat = fs.statSync(jsonlPath);
    mtimeMs = stat.mtimeMs;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[signals-reader] failed to read ${jsonlPath}: ${message}`);
    return { signals: [], parseErrors: [{ lineNumber: 0, error: message }], fileExists: true, mtimeMs: null };
  }

  const lines = raw.split("\n");
  const parsed: Signal[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const coerced = coerceNullsToUndefined(obj);
      const sig = SignalSchema.parse(coerced);
      parsed.push(sig);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      parseErrors.push({ lineNumber: i + 1, error: message });
      // Log but continue — one broken row shouldn't take down the feed.
      console.error(
        `[signals-reader] line ${i + 1} parse failed: ${message.slice(0, 200)}`
      );
    }
  }

  const collapsed = collapseLatestById(parsed);
  return { signals: collapsed, parseErrors, fileExists: true, mtimeMs };
}
