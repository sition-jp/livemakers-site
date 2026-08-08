import type { SessionsFeedData } from "@/lib/terminal/live-market-feed";
import {
  toSessionRecord,
  type SessionRecord,
} from "./session-content";

/**
 * Resolve the single canonical session URL without creating a parallel live
 * route. A crystallized repo article is authoritative; otherwise the current
 * already-validated feed may supply the pending record.
 */
export function resolveSessionPageRecord({
  slug,
  repoRecords,
  feedSessions,
}: {
  slug: string;
  repoRecords: readonly SessionRecord[];
  feedSessions: SessionsFeedData | null;
}): SessionRecord | null {
  const repoRecord = repoRecords.find((record) => record.sessionId === slug);
  if (repoRecord?.articleStatus === "published") return repoRecord;

  const feedRecord = feedSessions?.records.find(
    (record) => record.sessionId === slug,
  );
  if (feedRecord) {
    return toSessionRecord(feedRecord, { hasMaterializedRoute: false });
  }
  return repoRecord ?? null;
}
