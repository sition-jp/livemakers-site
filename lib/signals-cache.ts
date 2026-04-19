/**
 * Signals in-memory cache — wraps a ReadResult fetcher in a TTL + inflight-
 * dedup window, and exposes an explicit invalidate() hook for tests and
 * admin-driven force-refresh.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-signals-api-and-card-ui-design.md §2.4
 *
 * Design rationale:
 * - We do NOT reuse the generic TickerCache class directly. TickerCache is
 *   keyed per URL (multiple upstream endpoints) and its inflight map is
 *   keyed too — overkill for a single file read. A dedicated, single-keyed
 *   cache keeps the /api/signals hot path obvious and the invalidate
 *   semantics explicit (the ticker cache has no invalidate API).
 * - 60s TTL aligns with §2.4: SDE's daily batch is 1×/day and breakings are
 *   sporadic, so 60s is both low-latency and low-IO. The HTTP layer adds
 *   edge caching on top.
 * - On fetcher failure we serve stale (if available), matching TickerCache
 *   behavior. This prevents a transient disk blip from flipping the API
 *   to 503 for all callers.
 */
import type { ReadResult } from "./signals-reader";

interface CacheEntry {
  value: ReadResult;
  cachedAt: number;
}

export class SignalsCache {
  private entry: CacheEntry | null = null;
  private inflight: Promise<ReadResult> | null = null;
  private ttlMs: number;
  private fetcher: () => Promise<ReadResult>;

  constructor(ttlSeconds: number, fetcher: () => Promise<ReadResult>) {
    this.ttlMs = ttlSeconds * 1000;
    this.fetcher = fetcher;
  }

  async get(): Promise<ReadResult> {
    const now = Date.now();
    if (this.entry && now - this.entry.cachedAt < this.ttlMs) {
      return this.entry.value;
    }

    if (this.inflight) return this.inflight;

    const promise = (async () => {
      try {
        const fresh = await this.fetcher();
        this.entry = { value: fresh, cachedAt: Date.now() };
        return fresh;
      } catch (err) {
        if (this.entry) {
          console.error(
            "[signals-cache] fetcher failed, serving stale value:",
            err instanceof Error ? err.message : String(err)
          );
          return this.entry.value;
        }
        throw err;
      } finally {
        this.inflight = null;
      }
    })();

    this.inflight = promise;
    return promise;
  }

  /** Clear cache entry — next get() will refetch. */
  invalidate(): void {
    this.entry = null;
  }
}
