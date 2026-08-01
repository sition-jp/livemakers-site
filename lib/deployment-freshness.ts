/**
 * Deployment-stable freshness for server-rendered initialData.
 *
 * ISR cost doctrine (2026-08-01): Vercel bills an ISR write only when
 * revalidated content CHANGED from the cached version. The signals/intents
 * pages previously computed `freshnessSec` from request-time `Date.now()`,
 * which made every ISR regeneration byte-different and therefore a billed
 * write — Vercel's docs name `Date.now()` in ISR output as the canonical
 * "unexpected writes" bug. (Context: 200K write units / 30d on the Hobby
 * tier, 2026-08-01 usage audit.)
 *
 * This helper anchors freshness to NEXT_PUBLIC_BUILD_TIME_MS, a constant
 * baked at build time in next.config.ts — deterministic for the lifetime of
 * a deployment, so regenerations of unchanged data render identical output.
 * The value stays honest: it is the data file's age as of the deployment
 * build, and the client feeds (SWR, refreshInterval 30s against the /api
 * routes) replace it with live freshness within one poll cycle.
 *
 * Sentinel contract (unchanged from the inline versions this replaces):
 * missing mtime (null / undefined / 0) → -1 ("unknown", UI renders "—").
 */
export function deploymentFreshnessSec(
  mtimeMs: number | null | undefined
): number {
  const mtime = mtimeMs ?? 0;
  if (mtime === 0) return -1;
  const stamped = Number(process.env.NEXT_PUBLIC_BUILD_TIME_MS);
  // `next dev` has no build stamp — fall back to wall clock there (dev
  // renders are always dynamic, so determinism is irrelevant locally).
  const referenceMs =
    Number.isFinite(stamped) && stamped > 0 ? stamped : Date.now();
  return Math.max(0, Math.floor((referenceMs - mtime) / 1000));
}
