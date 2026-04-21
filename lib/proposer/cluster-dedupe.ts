import type { Cluster } from "@/lib/proposer/cluster-detect";
import type { TradeIntent } from "@/lib/intents";
import type { IntentRejectEntry } from "@/lib/intents-reject";

export interface FilterArgs {
  candidates: Cluster[];
  /** Intents to check against. Pre-filter by status/recency at call site if needed. */
  activeIntents: TradeIntent[];
  /** Reject log entries; caller is responsible for any time-window filter (e.g. 72h). */
  rejectLog: IntentRejectEntry[];
  /** Jaccard overlap threshold for source_signal_ids. Spec default: 0.5. */
  jaccardThreshold: number;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Filter duplicate clusters using 3 conditions:
 * 1. Jaccard overlap with active/approved/proposed/paused Intent source_signal_ids
 * 2. cluster_fingerprint match with reject log entries
 * 3. cluster_fingerprint match with pending proposed Intent proposer_metadata
 *
 * Ignores intents with status=cancelled/expired/completed (not blocking the cluster).
 */
export function filterDuplicateClusters(args: FilterArgs): Cluster[] {
  const { candidates, activeIntents, rejectLog, jaccardThreshold } = args;

  // Consider only intents that could block a new cluster
  const considerableIntents = activeIntents.filter(
    (i) =>
      i.status === "approved" ||
      i.status === "active" ||
      i.status === "proposed" ||
      i.status === "paused",
  );

  const rejectedFingerprints = new Set<string>(
    rejectLog.map((r) => r.cluster_fingerprint),
  );
  const pendingFingerprints = new Set<string>(
    considerableIntents
      .filter((i) => i.proposer_metadata?.cluster_fingerprint)
      .map((i) => i.proposer_metadata!.cluster_fingerprint),
  );

  return candidates.filter((c) => {
    // Condition 3: pending fingerprint collision
    if (pendingFingerprints.has(c.fingerprint)) return false;

    // Condition 2: recent reject fingerprint collision
    if (rejectedFingerprints.has(c.fingerprint)) return false;

    // Condition 1: Jaccard overlap with any considerable Intent's source_signal_ids
    const clusterIds = new Set(c.signals.map((s) => s.id));
    for (const intent of considerableIntents) {
      const intentIds = new Set(intent.source_signal_ids);
      if (jaccard(clusterIds, intentIds) >= jaccardThreshold) return false;
    }

    return true;
  });
}
