import {
  forbiddenSourceOpsTerms,
  forbiddenSourceVisibleText,
} from "@/lib/terminal/live-market-feed";

export const FORBIDDEN_DESIGN_TERMS = [
  "CO-EQUAL",
  "co-equal",
  "二面性",
  "ライブ面",
  "記事面",
  "対1",
  "対2",
  "対3",
  "対 1",
  "対 2",
  "対 3",
  "正典",
  "昇格",
  "SDE出力",
  "terminal-primary",
  "first-class",
] as const;

const EXTRA_OPS_TERMS = ["preflight", "sentinel", "chrome mcp"] as const;

export const FORBIDDEN_OPS_TERMS: readonly string[] = [
  ...forbiddenSourceOpsTerms,
  ...forbiddenSourceVisibleText,
  ...EXTRA_OPS_TERMS,
];

const ALLOWED_PUBLIC_LABELS = ["SDE検出"] as const;

export const matchesTerm = (haystackLower: string, term: string): boolean => {
  if (/^[a-z0-9_ /-]+$/.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?<![a-z0-9])${escaped}(?![a-z0-9])`,
    ).test(haystackLower);
  }
  return haystackLower.includes(term);
};

export function findForbiddenDesignTerms(text: string): string[] {
  const scrubbed = ALLOWED_PUBLIC_LABELS.reduce(
    (current, label) => current.split(label).join(""),
    text,
  );
  return FORBIDDEN_DESIGN_TERMS.filter((term) => scrubbed.includes(term));
}

export function findForbiddenOpsTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_OPS_TERMS.filter((term) =>
    matchesTerm(lower, term.toLowerCase()),
  );
}

export function findLiveTokenViolations(text: string): string[] {
  const scrubbed = text.replaceAll("LIVEMAKERS", "");
  return /(?<![A-Za-z])LIVE(?![A-Za-z])/.test(scrubbed) ? ["LIVE"] : [];
}

export function findRawInstrumentIdViolations(text: string): string[] {
  return [
    ...new Set(
      text.match(/(?<![a-z0-9])[a-z][a-z0-9]*_[a-z0-9_]+(?![a-z0-9_])/g) ??
        [],
    ),
  ];
}

export function collectScannableText(root: ParentNode): string {
  const parts = [root.textContent ?? ""];
  for (const element of root.querySelectorAll("[alt],[aria-label],[title]")) {
    for (const attribute of ["alt", "aria-label", "title"] as const) {
      const value = element.getAttribute(attribute);
      if (value) {
        parts.push(value);
      }
    }
  }
  return parts.join("\n");
}
