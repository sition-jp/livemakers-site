import fs from "fs";

export type TouchStore = Record<
  string,
  { skip_count: number; last_seen_at?: string }
>;

/**
 * Read the review-gate touch side-store. Missing file or malformed JSON
 * returns {}. Used by Morning Review Gate Step 0-a to derive skip_count +
 * last_seen_at_review_gate for expiry log entries.
 *
 * Spec §3.6 / §5.6 / Task 2-2 v0.2-alpha
 */
export function readTouches(path: string): TouchStore {
  if (!fs.existsSync(path)) return {};
  try {
    const raw = fs.readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as TouchStore;
  } catch {
    return {};
  }
}

function writeTouches(path: string, store: TouchStore): void {
  const tmp = path + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, path);
}

/**
 * Record that the reviewer saw this intent at the given time.
 * Does NOT increment skip_count (only recordSkip does).
 */
export function recordSeen(path: string, intentId: string, seenAt: string): void {
  const store = readTouches(path);
  const prev = store[intentId] ?? { skip_count: 0 };
  store[intentId] = { ...prev, last_seen_at: seenAt };
  writeTouches(path, store);
}

/**
 * Record that the reviewer explicitly skipped this intent.
 * Increments skip_count and updates last_seen_at.
 */
export function recordSkip(path: string, intentId: string, seenAt: string): void {
  const store = readTouches(path);
  const prev = store[intentId] ?? { skip_count: 0 };
  store[intentId] = {
    skip_count: prev.skip_count + 1,
    last_seen_at: seenAt,
  };
  writeTouches(path, store);
}
