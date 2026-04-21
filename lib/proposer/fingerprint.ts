import crypto from "crypto";

/**
 * Compute a deterministic 16-char SHA-256 fingerprint of a set of signal IDs.
 * Order-independent: same set of IDs always produces the same hash regardless
 * of input order. Used by the proposer to identify duplicate clusters across
 * nightly runs (§4.7).
 */
export function clusterFingerprint(signalIds: string[]): string {
  const sorted = [...signalIds].sort();
  return crypto
    .createHash("sha256")
    .update(sorted.join("|"))
    .digest("hex")
    .slice(0, 16);
}
