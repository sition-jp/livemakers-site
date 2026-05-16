import { existsSync } from "fs";
import path from "path";

/**
 * Resolve the best OG image path for a brief at a given locale.
 *
 * Fallback order:
 *   1. `/brief/{slug}/thumbnail-{lang}.png` (if exists on disk)
 *   2. `/brief/{slug}/thumbnail.png` (if exists on disk)
 *   3. `null` (caller should omit the `images` field)
 *
 * Critical: W15-W19 only have a single `thumbnail.png` (some have nothing,
 * e.g. W15). This function must NOT 404 when locale-specific files are
 * absent. Existence is checked against the filesystem at metadata-build
 * time (Next.js calls `generateMetadata` on the server with Node fs).
 *
 * Returns the public-relative URL (starting with `/`) or `null`.
 */
export function pickBriefImage(slug: string, lang: "ja" | "en"): string | null {
  // Reject slugs that aren't safe alphanumeric-dash identifiers — defense
  // in depth matching `getBriefBySlug` in lib/briefs.ts.
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;

  const baseDir = path.join(process.cwd(), "public", "brief", slug);
  const localeName = `thumbnail-${lang}.png`;
  const fallbackName = "thumbnail.png";

  if (existsSync(path.join(baseDir, localeName))) {
    return `/brief/${slug}/${localeName}`;
  }
  if (existsSync(path.join(baseDir, fallbackName))) {
    return `/brief/${slug}/${fallbackName}`;
  }
  return null;
}

/**
 * Strip the common Markdown markers used in our brief executive summaries
 * so the resulting text is safe to put in `<meta>` description / OG /
 * Twitter Card description fields.
 *
 * Handles:
 *   - `**bold**` → bold
 *   - `*italic*` → italic
 *   - `__bold__` → bold
 *   - `[text](url)` → text
 *   - inline `code` → code
 *   - newlines → spaces
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncate to `max` Unicode code points, appending `…` when truncated.
 * Uses `Array.from` so multi-byte characters (Japanese) count as 1 unit,
 * matching reader-perceived length.
 */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return chars.slice(0, max - 1).join("").trimEnd() + "…";
}
