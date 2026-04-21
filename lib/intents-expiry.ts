import fs from "fs";
import { z } from "zod";

export const ExpiryReasonSchema = z.enum([
  "timed_out_without_review",
  "skip_then_timeout",
]);
export type ExpiryReason = z.infer<typeof ExpiryReasonSchema>;

export const IntentExpiryEntrySchema = z.object({
  intent_id: z.string(),
  source_signal_ids: z.array(z.string()),
  cluster_fingerprint: z.string(),
  proposer_version: z.string(),
  expired_at: z.string().datetime(),
  reason: ExpiryReasonSchema,
  skip_count: z.number().int().min(0),
  last_seen_at_review_gate: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export type IntentExpiryEntry = z.infer<typeof IntentExpiryEntrySchema>;

// Single-writer assumption (CLI-driven). No concurrent-write protection here;
// callers that share the log file must serialize externally.
export function appendExpiryEntry(path: string, entry: IntentExpiryEntry): void {
  IntentExpiryEntrySchema.parse(entry);
  fs.appendFileSync(path, JSON.stringify(entry) + "\n");
}

/**
 * Read the expiry log. Forward-compatible: malformed lines or lines that
 * fail schema validation are silently skipped (enum expansion in v0.2-β may
 * introduce new expiry reasons that older readers cannot parse).
 *
 * CLI-only reader: missing file returns []; other I/O errors (EACCES/EIO)
 * propagate unstructured. Do not call from API routes without wrapping.
 */
export function readExpiryLog(path: string): IntentExpiryEntry[] {
  if (!fs.existsSync(path)) return [];
  const raw = fs.readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const out: IntentExpiryEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = IntentExpiryEntrySchema.safeParse(JSON.parse(line));
      if (parsed.success) out.push(parsed.data);
    } catch {
      // skip malformed line (forward-compat)
    }
  }
  return out;
}
