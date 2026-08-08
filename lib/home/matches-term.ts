/**
 * G43-d/e: extracted from reader-grammar.ts so it can be imported by
 * live-market-feed.ts (radar bundle titleJa scan; sessions bundle
 * titleJa/bullets scan, fix round 2 / I-1) without creating a circular
 * dependency — reader-grammar.ts imports forbidden vocabulary FROM
 * live-market-feed.ts, so live-market-feed.ts cannot import back from
 * reader-grammar.ts. This leaf module has no imports of its own.
 */
export const matchesTerm = (haystackLower: string, term: string): boolean => {
  if (/^[a-z0-9_ /-]+$/.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?<![a-z0-9])${escaped}(?![a-z0-9])`,
    ).test(haystackLower);
  }
  return haystackLower.includes(term);
};

/** Same LIVE-token rule as reader-grammar.ts's findLiveTokenViolations (which
 * re-exports this implementation) — duplicated here, not imported, for the
 * same circular-dependency reason as matchesTerm above. */
export function findLiveTokenViolations(text: string): string[] {
  const scrubbed = text.replaceAll("LIVEMAKERS", "");
  return /(?<![A-Za-z])LIVE(?![A-Za-z])/.test(scrubbed) ? ["LIVE"] : [];
}
