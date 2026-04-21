/**
 * Auto-expire 24h-old proposed intents.
 *
 * Scans tradeintents.jsonl for status="proposed" + authored_via="sde_auto_proposal"
 * entries older than `expireAfterHours` (measured against `created_at`). For
 * each, appends a status="expired" row (latest-row-wins semantics) and appends
 * an entry to `intent-expiry-log.jsonl`.
 *
 * Reason resolution:
 *   skipCountLookup > 0 → "skip_then_timeout"
 *   skipCountLookup = 0 → "timed_out_without_review"
 *
 * Idempotent: intents whose latest row is already `status != "proposed"` are
 * skipped, preventing re-expiry on repeated runs.
 *
 * Spec: §3.6 expiry log / §5.6 skip lifecycle / §4.6 expire_after_hours=24
 * Task: 2-2 v0.2-alpha E2
 */
import fs from "fs";
import { readAndParseIntents } from "@/lib/intents-reader";
import { appendExpiryEntry } from "@/lib/intents-expiry";
import type { TradeIntent } from "@/lib/intents";

export interface AutoExpireArgs {
  intentsJsonlPath: string;
  expiryLogJsonlPath: string;
  nowIso: string;
  expireAfterHours: number;
  /**
   * Called per intent_id to retrieve skip_count. Caller supplies lookup from
   * side-store (e.g., review-gate-touches.json in Task F2).
   */
  skipCountLookup: (intentId: string) => number;
  /** Optional: last_seen_at_review_gate timestamp per intent_id. */
  lastSeenLookup?: (intentId: string) => string | undefined;
}

export interface AutoExpireResult {
  expired: string[];
}

export function autoExpirePendingProposals(
  args: AutoExpireArgs,
): AutoExpireResult {
  const { intents: all } = readAndParseIntents(args.intentsJsonlPath);

  const nowMs = Date.parse(args.nowIso);
  const cutoffMs = args.expireAfterHours * 3600 * 1000;

  // Latest-row-wins per intent_id — mirrors collapseLatestIntentById semantics
  // (tie-break: last row in input wins on equal updated_at).
  const latestMap = new Map<string, TradeIntent>();
  for (const i of all) {
    const prev = latestMap.get(i.intent_id);
    if (!prev || i.updated_at >= prev.updated_at) {
      latestMap.set(i.intent_id, i);
    }
  }

  const expired: string[] = [];
  for (const intent of latestMap.values()) {
    if (intent.status !== "proposed") continue;
    if (intent.authored_via !== "sde_auto_proposal") continue;
    const createdMs = Date.parse(intent.created_at);
    if (nowMs - createdMs < cutoffMs) continue;

    const skipCount = args.skipCountLookup(intent.intent_id);
    const reason =
      skipCount > 0 ? "skip_then_timeout" : "timed_out_without_review";
    const fingerprint = intent.proposer_metadata?.cluster_fingerprint ?? "";
    const version = intent.proposer_metadata?.version ?? "unknown";
    const lastSeen = args.lastSeenLookup?.(intent.intent_id);

    // Order: expiry-log first (if it throws, intent stays proposed → retried next run).
    // If intent-append throws after log append, next run creates a duplicate log entry
    // which is recoverable; orphan-expired (log missing) is not.
    appendExpiryEntry(args.expiryLogJsonlPath, {
      intent_id: intent.intent_id,
      source_signal_ids: intent.source_signal_ids,
      cluster_fingerprint: fingerprint,
      proposer_version: version,
      expired_at: args.nowIso,
      reason,
      skip_count: skipCount,
      ...(lastSeen ? { last_seen_at_review_gate: lastSeen } : {}),
      created_at: intent.created_at,
    });

    // Build expired row (preserve all fields, override status/updated_at).
    // visibility stays private (sde_auto_proposal invariant).
    const expiredRow: TradeIntent = {
      ...intent,
      status: "expired",
      visibility: "private",
      updated_at: args.nowIso,
    };
    fs.appendFileSync(
      args.intentsJsonlPath,
      JSON.stringify(expiredRow) + "\n",
    );

    expired.push(intent.intent_id);
  }

  return { expired };
}
