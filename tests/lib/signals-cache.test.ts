import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignalsCache } from "@/lib/signals-cache";
import type { ReadResult } from "@/lib/signals-reader";

function fakeResult(signalCount: number, mtimeMs = 1_700_000_000_000): ReadResult {
  // Produce a fake ReadResult with minimal valid-shape signals for cache tests.
  // Content shape isn't validated by the cache layer.
  const signals = Array.from({ length: signalCount }).map(
    (_, i) => ({ id: `sig_${i}`, confidence: 0.8 } as unknown as ReadResult["signals"][number])
  );
  return { signals, parseErrors: [], fileExists: true, mtimeMs };
}

describe("lib/signals-cache — SignalsCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00Z"));
  });

  it("C-1: TTL window — same Promise / same value for concurrent calls (inflight dedup)", async () => {
    let resolve: (v: ReadResult) => void = () => {};
    const fetcher = vi.fn(
      () => new Promise<ReadResult>((r) => (resolve = r))
    );
    const cache = new SignalsCache(60, fetcher);

    const p1 = cache.get();
    const p2 = cache.get();
    resolve(fakeResult(5));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.signals.length).toBe(5);
    expect(r2.signals.length).toBe(5);
    // Inflight dedup: fetcher invoked once for both calls.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("C-2: returns cached value within TTL, refetches after TTL expires", async () => {
    const fetcher = vi
      .fn<() => Promise<ReadResult>>()
      .mockResolvedValueOnce(fakeResult(3))
      .mockResolvedValueOnce(fakeResult(7));
    const cache = new SignalsCache(60, fetcher);

    const first = await cache.get();
    expect(first.signals.length).toBe(3);
    vi.advanceTimersByTime(30 * 1000); // within TTL
    const cached = await cache.get();
    expect(cached.signals.length).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(40 * 1000); // past TTL (30+40=70 > 60)
    const refetched = await cache.get();
    expect(refetched.signals.length).toBe(7);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("C-3: fetcher failure — returns stale value if one exists", async () => {
    const fetcher = vi
      .fn<() => Promise<ReadResult>>()
      .mockResolvedValueOnce(fakeResult(4))
      .mockRejectedValueOnce(new Error("disk gone"));
    const cache = new SignalsCache(60, fetcher);

    await cache.get();
    vi.advanceTimersByTime(61 * 1000);
    const r = await cache.get();
    expect(r.signals.length).toBe(4); // stale served
  });

  it("C-4: fetcher failure with no cached value — throws", async () => {
    const fetcher = vi
      .fn<() => Promise<ReadResult>>()
      .mockRejectedValue(new Error("disk gone"));
    const cache = new SignalsCache(60, fetcher);
    await expect(cache.get()).rejects.toThrow("disk gone");
  });

  it("C-5: invalidate() forces refetch on next call", async () => {
    const fetcher = vi
      .fn<() => Promise<ReadResult>>()
      .mockResolvedValueOnce(fakeResult(2))
      .mockResolvedValueOnce(fakeResult(9));
    const cache = new SignalsCache(60, fetcher);
    await cache.get();
    cache.invalidate();
    const second = await cache.get();
    expect(second.signals.length).toBe(9);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
