/**
 * G43-d: extracted from reader-grammar.ts so it can be imported by
 * live-market-feed.ts (radar bundle titleJa scan) without creating a
 * circular dependency — reader-grammar.ts imports forbidden vocabulary
 * FROM live-market-feed.ts, so live-market-feed.ts cannot import back from
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
