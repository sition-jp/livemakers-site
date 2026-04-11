import { describe, it, expect, beforeEach, vi } from "vitest";
import { TickerCache } from "@/lib/server/ticker-cache";

describe("TickerCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T00:00:00Z"));
  });

  it("fetches on first call", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const cache = new TickerCache(300);
    const result = await cache.get("test", fetcher);
    expect(result).toEqual({ value: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns cached value within TTL", async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const cache = new TickerCache(300);
    await cache.get("test", fetcher);

    vi.advanceTimersByTime(60 * 1000);
    const result = await cache.get("test", fetcher);
    expect(result).toEqual({ value: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches after TTL expires", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: 1 })
      .mockResolvedValueOnce({ value: 2 });
    const cache = new TickerCache(300);
    await cache.get("test", fetcher);

    vi.advanceTimersByTime(301 * 1000);
    const result = await cache.get("test", fetcher);
    expect(result).toEqual({ value: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent in-flight calls", async () => {
    let resolve: (v: { value: number }) => void = () => {};
    const fetcher = vi.fn(
      () => new Promise<{ value: number }>((r) => (resolve = r))
    );
    const cache = new TickerCache(300);

    const p1 = cache.get("test", fetcher);
    const p2 = cache.get("test", fetcher);
    resolve({ value: 42 });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ value: 42 });
    expect(r2).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns stale value on fetcher error", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ value: 1 })
      .mockRejectedValueOnce(new Error("network down"));
    const cache = new TickerCache(300);
    await cache.get("test", fetcher);

    vi.advanceTimersByTime(301 * 1000);
    const result = await cache.get("test", fetcher);
    expect(result).toEqual({ value: 1 });
  });

  it("throws if fetcher errors and no cached value exists", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const cache = new TickerCache(300);
    await expect(cache.get("test", fetcher)).rejects.toThrow("network down");
  });
});
