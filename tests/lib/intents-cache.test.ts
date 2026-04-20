// tests/lib/intents-cache.test.ts
import { describe, it, expect, vi } from "vitest";
import { IntentsCache } from "@/lib/intents-cache";
import type { IntentsReadResult } from "@/lib/intents-reader";

function stubResult(tag: string): IntentsReadResult {
  return {
    intents: [],
    parseErrors: [],
    fileExists: true,
    mtimeMs: Date.now(),
  };
}

describe("lib/intents-cache — IntentsCache", () => {
  it("IC-1: first call invokes fetcher", async () => {
    const fetcher = vi.fn(async () => stubResult("a"));
    const cache = new IntentsCache(60, fetcher);
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("IC-2: second call within TTL serves cached value", async () => {
    const fetcher = vi.fn(async () => stubResult("a"));
    const cache = new IntentsCache(60, fetcher);
    await cache.get();
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("IC-3: invalidate() forces next call to refetch", async () => {
    const fetcher = vi.fn(async () => stubResult("a"));
    const cache = new IntentsCache(60, fetcher);
    await cache.get();
    cache.invalidate();
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("IC-4: concurrent calls dedupe into single inflight fetch", async () => {
    let resolveFn: (v: IntentsReadResult) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<IntentsReadResult>((r) => {
          resolveFn = r;
        }),
    );
    const cache = new IntentsCache(60, fetcher);
    const p1 = cache.get();
    const p2 = cache.get();
    resolveFn(stubResult("a"));
    await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("IC-5: fetcher failure with prior cached value serves stale", async () => {
    let call = 0;
    const fetcher = vi.fn(async () => {
      call++;
      if (call === 1) return stubResult("a");
      throw new Error("disk gone");
    });
    const cache = new IntentsCache(0, fetcher); // TTL 0 forces refetch
    const first = await cache.get();
    const second = await cache.get();
    expect(second).toBe(first);
  });
});
