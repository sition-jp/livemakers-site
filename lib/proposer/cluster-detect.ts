import type { Signal } from "@/lib/signals";
import type { ProposerConfig } from "@/lib/proposer/config";
import { clusterFingerprint } from "@/lib/proposer/fingerprint";

export interface Cluster {
  signals: Signal[];
  primary_asset: string;
  direction: "positive" | "negative" | "neutral" | "mixed";
  fingerprint: string;
  score: number; // avg(confidence × impact_weight)
}

export interface DetectResult {
  clusters: Cluster[];
  mixed_skipped: number;
}

/**
 * 6-step cluster detection algorithm (Spec §4.1 Step 1-6):
 *
 * 1. Filter to `supported_assets` only (BTC/ETH/ADA/NIGHT)
 * 2. Group by primary_asset × direction
 * 3. Exclude `mixed` direction cluster; count separately as `mixed_skipped` (Finding 4)
 * 4. Drop clusters with `< min_cluster_size`
 * 5. Drop clusters with `avg(confidence) < min_avg_confidence`
 * 6. Rank remaining clusters by `avg(confidence × impact_weight)` descending
 */
export function detectClusters(
  signals: Signal[],
  config: ProposerConfig,
): DetectResult {
  const supported = new Set<string>(config.supported_assets);
  const excluded = new Set<string>(config.excluded_cluster_directions);

  // Step 1: filter to supported assets only
  const filtered = signals.filter(
    (s) => s.primary_asset !== undefined && supported.has(s.primary_asset),
  );

  // Step 2-3: group by primary_asset × direction; count and exclude mixed
  let mixed_skipped = 0;
  const groups = new Map<string, Signal[]>();
  for (const sig of filtered) {
    const dir = sig.direction;
    if (excluded.has(dir)) {
      mixed_skipped++;
      continue;
    }
    const key = `${sig.primary_asset}|${dir}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(sig);
  }

  // Step 4-5: build clusters, filter by min_cluster_size + min_avg_confidence
  const candidates: Cluster[] = [];
  for (const [key, sigs] of groups.entries()) {
    if (sigs.length < config.min_cluster_size) continue;
    const avgConf =
      sigs.reduce((acc, s) => acc + s.confidence, 0) / sigs.length;
    if (avgConf < config.min_avg_confidence) continue;

    const [asset, dirStr] = key.split("|");
    const dir = dirStr as Cluster["direction"];
    const score =
      sigs.reduce((acc, s) => {
        const iw =
          config.impact_weight[s.impact as keyof typeof config.impact_weight] ??
          0.3;
        return acc + s.confidence * iw;
      }, 0) / sigs.length;

    candidates.push({
      signals: sigs,
      primary_asset: asset,
      direction: dir,
      fingerprint: clusterFingerprint(sigs.map((s) => s.id)),
      score,
    });
  }

  // Step 6: sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return { clusters: candidates, mixed_skipped };
}
