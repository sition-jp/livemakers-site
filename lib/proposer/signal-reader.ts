import { readAndParseSignals } from "@/lib/signals-reader";
import type { Signal } from "@/lib/signals";

export interface ReadActiveSignalsOpts {
  signalsJsonlPath: string;
  windowHours: number;
  /** ISO timestamp for "now" — injectable for testability. Defaults to new Date().toISOString() */
  nowIso?: string;
}

/**
 * Read active signals within a time window for proposer cluster detection.
 *
 * Delegates to lib/signals-reader.readAndParseSignals() for file access,
 * null coercion (production jsonl serializes Python Optional[T] as JSON null),
 * schema validation, and latest-row-wins collapse by id (insertion order —
 * matches SignalStore.read_active_signals() append-only semantics).
 *
 * Proposer-specific filter applied on top:
 *   - status === "active"
 *   - created_at >= now - windowHours
 *
 * Behavior:
 *   - Missing file → [] (non-blocking; readAndParseSignals handles ENOENT)
 *   - Malformed/schema-failing lines → skipped + logged by readAndParseSignals
 *   - parseErrors count is not surfaced (CLI-only reader, forward-compat skip)
 *
 * Why delegation over from-scratch parsing:
 *   The committed SignalSchema uses `.optional()` (undefined-only), but the
 *   Python writer emits JSON null for Optional[T] fields. The shared reader
 *   has `coerceNullsToUndefined()` to bridge this at the reader boundary.
 *   A from-scratch implementation would silently drop 100% of production
 *   rows — the bug this module exists to avoid.
 */
export function readActiveSignals(opts: ReadActiveSignalsOpts): Signal[] {
  const { signals } = readAndParseSignals(opts.signalsJsonlPath);
  const nowMs = Date.parse(opts.nowIso ?? new Date().toISOString());
  const cutoffMs = nowMs - opts.windowHours * 3600 * 1000;
  return signals.filter(
    (s) => s.status === "active" && Date.parse(s.created_at) >= cutoffMs,
  );
}
