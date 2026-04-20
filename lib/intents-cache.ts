/**
 * IntentsCache — 60s TTL + inflight dedup + stale-on-failure.
 *
 * Mirror of lib/signals-cache.ts SignalsCache.
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §6.5
 */
import type { IntentsReadResult } from "./intents-reader";

interface Entry {
  value: IntentsReadResult;
  cachedAt: number;
}

export class IntentsCache {
  private entry: Entry | null = null;
  private inflight: Promise<IntentsReadResult> | null = null;
  private ttlMs: number;
  private fetcher: () => Promise<IntentsReadResult>;

  constructor(ttlSeconds: number, fetcher: () => Promise<IntentsReadResult>) {
    this.ttlMs = ttlSeconds * 1000;
    this.fetcher = fetcher;
  }

  async get(): Promise<IntentsReadResult> {
    const now = Date.now();
    if (this.entry && now - this.entry.cachedAt < this.ttlMs) {
      return this.entry.value;
    }
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const value = await this.fetcher();
        this.entry = { value, cachedAt: Date.now() };
        return value;
      } catch (err) {
        if (this.entry) {
          console.error(
            "[intents-cache] fetcher failed, serving stale value:",
            err instanceof Error ? err.message : String(err),
          );
          return this.entry.value;
        }
        throw err;
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  invalidate() {
    this.entry = null;
  }
}
