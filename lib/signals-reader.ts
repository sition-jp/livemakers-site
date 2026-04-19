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

// -----------------------------------------------------------------------------
// Task 1-3 additions (spec 2026-04-19-lm-task-1-3-signal-detail-design.md §5.2)
// -----------------------------------------------------------------------------

/**
 * ChainStatus describes the state of a Signal's supersede chain relative
 * to the current detail-page query. Each value is emitted by exactly one
 * case in `buildSignalDetailResponse`:
 *
 * - "ok":                found + root_trace_id present + >= 2 rows in chain
 * - "missing_root_trace": found + root_trace_id is null/undefined (legacy)
 * - "singleton_fallback": found + root_trace_id present + only 1 row (self)
 * - "not_found":         signal not found at all (meta.found === false)
 *
 * Invariant: meta.found === (chain_status !== "not_found").
 */
export type ChainStatus =
  | "ok"
  | "missing_root_trace"
  | "singleton_fallback"
  | "not_found";

/**
 * Output of `buildSupersedeChain`. Does NOT include "not_found" in status —
 * that variant is emitted only at the `buildSignalDetailResponse` level,
 * because buildSupersedeChain is only ever called when a signal was found.
 */
export interface ChainResult {
  chain: Signal[];
  status: Exclude<ChainStatus, "not_found">;
  warnings: string[];
}

/**
 * Shape returned by both `/api/signals/[id]` and the SSR page component.
 * Single source of truth for response assembly (spec §5.2 v0.3 Finding 3).
 */
export interface SignalDetailResponse {
  signal: Signal | null;
  chain: Signal[];
  chain_status: ChainStatus;
  chain_integrity_warnings: string[];
  meta: {
    found: boolean;
    chain_length: number;
    root_trace_id: string | null;
    source_freshness_sec: number;
  };
}

/**
 * Return the signal with the given id, or null if not found.
 *
 * Precondition: `signals` is post-collapse (latest-row-wins per id),
 * as produced by `readAndParseSignals` (which calls `collapseLatestById`
 * internally). Consumers may assume id uniqueness.
 *
 * v0.3 assumption pin: readAndParseSignals() is the only supported
 * producer of this input; manual arrays in tests must preserve the
 * same uniqueness postcondition.
 */
export function getSignalById(signals: Signal[], id: string): Signal | null {
  return signals.find((s) => s.id === id) ?? null;
}

/**
 * Build the supersede chain for a given signal (spec §5.2).
 *
 * Callers MUST pass a non-null `current`. The "not_found" status is
 * not emitted here — it's produced at the buildSignalDetailResponse
 * layer when getSignalById returns null (v0.3 Finding 1 separation).
 *
 * Status semantics:
 *   - current.root_trace_id == null → status="missing_root_trace", chain=[]
 *   - root_trace_id present, 1 match (self only) → "singleton_fallback"
 *   - root_trace_id present, >= 2 matches → "ok", chain asc by updated_at
 *
 * Warnings: only emitted for "ok" status; adjacency-based check
 * (see verifyChainIntegrity). Do NOT downgrade status on warnings —
 * they annotate for analyst review.
 */
export function buildSupersedeChain(
  signals: Signal[],
  current: Signal,
): ChainResult {
  if (current.root_trace_id === null || current.root_trace_id === undefined) {
    return { chain: [], status: "missing_root_trace", warnings: [] };
  }

  const rootTraceId = current.root_trace_id;
  const candidates = signals
    .filter((s) => s.root_trace_id === rootTraceId)
    .sort((a, b) => (a.updated_at ?? "").localeCompare(b.updated_at ?? ""));

  if (candidates.length <= 1) {
    return { chain: candidates, status: "singleton_fallback", warnings: [] };
  }

  const warnings = verifyChainIntegrity(candidates);
  return { chain: candidates, status: "ok", warnings };
}

/**
 * Walk the chain ascending by updated_at and verify that each row's
 * supersedes_signal_id points to the IMMEDIATELY PRECEDING row's id
 * in the chain (v0.3 Finding 2 — adjacency semantics).
 *
 * Rules:
 *   - Row 0 (oldest): supersedes_signal_id MUST be null or undefined.
 *     If present, emit "oldest row {id} has unexpected supersedes_signal_id={x}".
 *   - Row i > 0: supersedes_signal_id MUST equal chainAsc[i-1].id.
 *     If different (including null/undefined), emit "lineage break at {id}:
 *     supersedes_signal_id={x} but immediately prior row in chain (asc) is {prevId}".
 *
 * Rationale: Phase 1 signal generator produces strictly linear chains.
 * Any deviation indicates backfill, manual repair, migration error, or
 * a generator bug. Warnings surface for analyst review without
 * downgrading `chain_status`.
 */
export function verifyChainIntegrity(chainAsc: Signal[]): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < chainAsc.length; i++) {
    const row = chainAsc[i];
    const supersedes = row.supersedes_signal_id ?? null;
    if (i === 0) {
      if (supersedes !== null) {
        warnings.push(
          `oldest row ${row.id} has unexpected supersedes_signal_id=${supersedes ?? "null"}`,
        );
      }
    } else {
      const expected = chainAsc[i - 1].id;
      if (supersedes !== expected) {
        warnings.push(
          `lineage break at ${row.id}: supersedes_signal_id=${supersedes ?? "null"} ` +
            `but immediately prior row in chain (asc) is ${expected}`,
        );
      }
    }
  }
  return warnings;
}

/**
 * Single source of truth for `SignalDetailResponse` assembly (spec §5.2
 * v0.3 Finding 3). BOTH `app/api/signals/[id]/route.ts` AND
 * `app/[locale]/signals/[id]/page.tsx` call this function; adding a
 * field to SignalDetailResponse later means touching one function, not
 * synchronizing two call sites.
 *
 * Emits chain_status="not_found" when getSignalById returns null.
 * Delegates other status cases to buildSupersedeChain.
 *
 * Precondition: `allSignals` is post-collapse latest-row-wins per id
 * (from readAndParseSignals).
 */
export function buildSignalDetailResponse(
  allSignals: Signal[],
  id: string,
  sourceFreshnessSec: number,
): SignalDetailResponse {
  const signal = getSignalById(allSignals, id);
  if (signal === null) {
    return {
      signal: null,
      chain: [],
      chain_status: "not_found",
      chain_integrity_warnings: [],
      meta: {
        found: false,
        chain_length: 0,
        root_trace_id: null,
        source_freshness_sec: sourceFreshnessSec,
      },
    };
  }
  const chainResult = buildSupersedeChain(allSignals, signal);
  return {
    signal,
    chain: chainResult.chain,
    chain_status: chainResult.status,
    chain_integrity_warnings: chainResult.warnings,
    meta: {
      found: true,
      chain_length: chainResult.chain.length,
      root_trace_id: signal.root_trace_id ?? null,
      source_freshness_sec: sourceFreshnessSec,
    },
  };
}
