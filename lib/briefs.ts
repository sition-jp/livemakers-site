import fs from "fs";
import path from "path";
import type { Brief, BriefMetadata } from "./types";

const BRIEF_DIR = path.join(process.cwd(), "content", "brief");

function readMeta(slug: string): BriefMetadata | null {
  const metaPath = path.join(BRIEF_DIR, slug, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  const raw = fs.readFileSync(metaPath, "utf-8");
  try {
    return JSON.parse(raw) as BriefMetadata;
  } catch {
    return null;
  }
}

export function getAllBriefs(): BriefMetadata[] {
  if (!fs.existsSync(BRIEF_DIR)) return [];
  const slugs = fs
    .readdirSync(BRIEF_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => !slug.startsWith("test-"));

  const metas = slugs
    .map((slug) => readMeta(slug))
    .filter((m): m is BriefMetadata => m !== null);

  metas.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  return metas;
}

export function getBriefBySlug(slug: string): Brief | null {
  // Reject any slug that isn't a safe alphanumeric-dash identifier — prevents
  // path traversal via '..' or absolute paths when this is called outside the
  // Next.js routing layer (e.g. from CLI tools or tests).
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  const metadata = readMeta(slug);
  if (!metadata) return null;

  const jaPath = path.join(BRIEF_DIR, slug, "ja.md");
  const enPath = path.join(BRIEF_DIR, slug, "en.md");

  const bodyJa = fs.existsSync(jaPath) ? fs.readFileSync(jaPath, "utf-8") : "";
  const bodyEn = fs.existsSync(enPath) ? fs.readFileSync(enPath, "utf-8") : "";

  return {
    slug,
    metadata,
    bodyJa,
    bodyEn,
    pdfPath: `/brief/${slug}/brief.pdf`,
  };
}

export function getLatestBrief(): Brief | null {
  const all = getAllBriefs();
  if (all.length === 0) return null;
  return getBriefBySlug(all[0].slug);
}
