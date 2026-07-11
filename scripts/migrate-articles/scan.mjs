import fs from "node:fs";
import path from "node:path";

const registry = JSON.parse(
  fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts/migrate-articles/forbidden-terms.json",
    ),
    "utf8",
  ),
);

const matchesTermEdgeAware = (haystackLower, term) => {
  if (/^[a-z0-9_ /-]+$/.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lead = /^[a-z0-9]/.test(term) ? "(?<![a-z0-9])" : "";
    const tail = /[a-z0-9]$/.test(term) ? "(?![a-z0-9])" : "";
    return new RegExp(`${lead}${escaped}${tail}`).test(haystackLower);
  }
  return haystackLower.includes(term);
};

export function scanForbidden(text) {
  const scrubbed = registry.allowedPublicLabels.reduce(
    (current, label) => current.split(label).join(""),
    text,
  );
  const designHits = registry.designTerms.filter((term) =>
    scrubbed.includes(term),
  );
  const lower = text.toLowerCase();
  const opsHits = registry.opsTerms.filter((term) =>
    matchesTermEdgeAware(lower, term.toLowerCase()),
  );
  return [...new Set([...designHits, ...opsHits])];
}
