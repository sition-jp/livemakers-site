import fs from "fs";
import { SignalSchema, type Signal } from "@/lib/signals";

export interface ReadActiveSignalsOpts {
  signalsJsonlPath: string;
  windowHours: number;
  /** ISO timestamp for "now" — injectable for testability. Defaults to new Date().toISOString() */
  nowIso?: string;
}

/**
 * Read active signals from signals.jsonl with latest-row-wins per id +
 * status=active filter + time window filter.
 *
 * - Missing file returns [] (non-blocking, proposer continues with 0 signals)
 * - Malformed / schema-failing lines are silently skipped (forward-compat)
 * - Latest row per signal_id wins (append-only jsonl semantics, matches
 *   SignalStore.read_active_signals() in signal-generator)
 *
 * CLI-only reader: I/O errors other than ENOENT propagate unstructured.
 */
export function readActiveSignals(opts: ReadActiveSignalsOpts): Signal[] {
  if (!fs.existsSync(opts.signalsJsonlPath)) return [];
  const raw = fs.readFileSync(opts.signalsJsonlPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  // Parse all lines, keep latest per id
  const latestPerId = new Map<string, Signal>();
  for (const line of lines) {
    try {
      const parsed = SignalSchema.safeParse(JSON.parse(line));
      if (!parsed.success) continue;
      const sig = parsed.data;
      const existing = latestPerId.get(sig.id);
      if (
        !existing ||
        Date.parse(sig.created_at) >= Date.parse(existing.created_at)
      ) {
        latestPerId.set(sig.id, sig);
      }
    } catch {
      // skip malformed line
    }
  }

  const nowMs = Date.parse(opts.nowIso ?? new Date().toISOString());
  const cutoffMs = nowMs - opts.windowHours * 3600 * 1000;

  const out: Signal[] = [];
  for (const sig of latestPerId.values()) {
    if (sig.status !== "active") continue;
    if (Date.parse(sig.created_at) < cutoffMs) continue;
    out.push(sig);
  }
  return out;
}
