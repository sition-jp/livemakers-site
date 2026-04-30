/**
 * GET /api/dashboard/live — Terminal v2 live snapshot endpoint.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-30-sde-terminal-live-snapshot-v0.1.md §4.1
 *
 * Composition (mirrors /api/dashboard pattern):
 *   live-snapshot-reader (file read + zod validate)
 *     → this route (HTTP contract: no-store, Server-Timing, degrade rules)
 *
 * HTTP contract (spec §4.1 + Day 3-4 review):
 *   - Cache-Control: no-store        (reads must hit the route, no CDN cache)
 *   - Server-Timing: read;dur=<ms>   (standard form, visible in DevTools)
 *   - No ETag / 304                  (incompatible with no-store, not useful here)
 *
 * Degrade matrix:
 *   - file absent              → 200 + emptyLiveSnapshot() (pre-cron / pre-launch)
 *   - JSON malformed           → 503
 *   - schema violation         → 503
 *   - happy path               → 200 + TerminalLiveSnapshot
 *
 * Read-only contract (spec §4.2): no external API fetches, no persistence,
 * no SDE-side backfill. We only read the materialised file and pass it
 * through after schema validation.
 */
import { NextResponse } from "next/server";
import { readTerminalLiveSnapshot } from "@/lib/terminal/live-snapshot-reader";
import { emptyLiveSnapshot } from "@/lib/terminal/empty-live";

const CACHE_CONTROL = "no-store";

function serverTimingHeader(readMs: number): string {
  // Standard `<metric>;dur=<ms>` form so Chrome/Firefox DevTools render it
  // in the Network tab's "Timing" panel.
  return `read;dur=${readMs.toFixed(1)}`;
}

export async function GET(): Promise<Response> {
  const startedAt = performance.now();
  const result = await readTerminalLiveSnapshot();
  const readMs = performance.now() - startedAt;

  const baseHeaders: Record<string, string> = {
    "cache-control": CACHE_CONTROL,
    "server-timing": serverTimingHeader(readMs),
  };

  // Degrade case: file absent → 200 + skeleton (pre-cron state).
  if (!result.fileExists && result.parseError === null) {
    return NextResponse.json(emptyLiveSnapshot(new Date()), {
      headers: baseHeaders,
    });
  }

  // Degrade case: file present but parse/schema failed → 503.
  if (result.snapshot === null) {
    return NextResponse.json(
      {
        error: "live snapshot unavailable",
        reason: result.parseError ?? "unknown",
      },
      { status: 503, headers: baseHeaders },
    );
  }

  // Happy path: pass-through.
  return NextResponse.json(result.snapshot, { headers: baseHeaders });
}
