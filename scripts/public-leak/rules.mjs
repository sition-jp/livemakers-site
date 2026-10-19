// This repository is public. These rules catch internal operating details
// (local machine paths, private repository names, internal memory/instruction
// file names, secret file locations) before they land in a commit.
//
// Two scopes:
//   "public-surface" — files rendered on livemakers.com (content/, public/,
//                      messages/). Every rule applies to the whole file.
//   "all-added"      — any other file. Only lines added by the change are
//                      checked, and only against rules marked allAdded.
//
// A line that genuinely needs one of these strings can opt out with the
// marker `public-leak-allow` on the same line.

export const ALLOW_MARKER = "public-leak-allow";

export const PUBLIC_SURFACE_PREFIXES = ["content/", "public/", "messages/"];

// Files that must contain the patterns themselves.
export const SELF_EXCLUDED_PREFIXES = [
  "scripts/public-leak/",
  "tests/scripts/public-leak",
];

export const RULES = [
  {
    id: "local-home-path",
    label: "local machine path (/Users/<name>/)",
    pattern: /\/Users\/[A-Za-z0-9._-]+\//,
    allAdded: true,
  },
  {
    id: "memory-file",
    label: "internal memory file name",
    pattern: /\b(?:project|feedback|reference|user)_[a-z0-9_]+\.md\b|\bMEMORY(?:_REFERENCE)?\.md\b/,
    allAdded: true,
  },
  {
    id: "agent-instructions",
    label: "internal agent instruction file (CLAUDE.md / AGENTS.md)",
    pattern: /\b(?:CLAUDE|AGENTS)\.md\b/,
    allAdded: false,
  },
  {
    id: "private-repo",
    label: "private repository name",
    pattern:
      /\bsition-(?:core|discovery-engine|control-plane|intelligence-terminal)\b|\bsition-jp\/(?:ai-autotrader|sipo-tokyo|lifemakers-site|sition-jp|sition-io)\b/,
    allAdded: false,
  },
  {
    id: "internal-dir",
    label: "internal workspace directory (07_DATA/ / 08_DOCS/)",
    pattern: /\b0[78]_(?:DATA|DOCS)\//,
    allAdded: false,
  },
  {
    id: "secret-location",
    label: "secret file location",
    pattern: /\bsecrets\.env\b|~\/\.sition\//,
    allAdded: false,
  },
];

export const isPublicSurface = (filePath) =>
  PUBLIC_SURFACE_PREFIXES.some((prefix) => filePath.startsWith(prefix));

export const isSelfExcluded = (filePath) =>
  SELF_EXCLUDED_PREFIXES.some((prefix) => filePath.startsWith(prefix));

const rulesFor = (filePath) =>
  isPublicSurface(filePath) ? RULES : RULES.filter((rule) => rule.allAdded);

// lines: array of { line: number, text: string }
export const scanLines = (filePath, lines) => {
  if (isSelfExcluded(filePath)) return [];
  const rules = rulesFor(filePath);
  const findings = [];
  for (const { line, text } of lines) {
    if (text.includes(ALLOW_MARKER)) continue;
    for (const rule of rules) {
      const match = text.match(rule.pattern);
      if (match) {
        findings.push({ file: filePath, line, rule: rule.id, label: rule.label, match: match[0] });
      }
    }
  }
  return findings;
};

export const scanText = (filePath, text) =>
  scanLines(
    filePath,
    text.split("\n").map((lineText, index) => ({ line: index + 1, text: lineText })),
  );
