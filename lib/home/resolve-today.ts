const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JST calendar date (YYYY-MM-DD) for the given instant. Pure — inject now. */
export function resolveTodayJst(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}
