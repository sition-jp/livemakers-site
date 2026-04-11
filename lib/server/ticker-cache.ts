interface CacheEntry<T> {
  value: T;
  cachedAt: number;
}

export class TickerCache {
  private entries = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();
  private ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (entry && now - entry.cachedAt < this.ttlMs) {
      return entry.value;
    }

    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = (async () => {
      try {
        const fresh = await fetcher();
        this.entries.set(key, { value: fresh, cachedAt: Date.now() });
        return fresh;
      } catch (err) {
        if (entry) return entry.value;
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }
}
