import type { TerminalAdapterPacket } from "./types";

export const FORBIDDEN_TERMINAL_VISIBLE_TERMS = [
  /\bbuy\b/i,
  /\bsell\b/i,
  /\blong\b/i,
  /\bshort\b/i,
  /\baccumulate\b/i,
  /\breduce\b/i,
  /\bactionable signal\b/i,
  /\btrade intent\b/i,
  /\bexecution\b/i,
  /\bpaper\b/i,
  /\blive\b/i,
];

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
}

export function collectTerminalVisibleCopy(
  packet: TerminalAdapterPacket,
): string[] {
  return packet.modules.flatMap((module) => [
    ...collectStrings(module.payload),
    module.unavailable.display_label_en,
    module.unavailable.display_label_ja,
  ]);
}

export function findForbiddenTerminalVisibleTerms(
  packet: TerminalAdapterPacket,
): Array<{ text: string; pattern: string }> {
  const visibleCopy = collectTerminalVisibleCopy(packet);
  const matches: Array<{ text: string; pattern: string }> = [];

  for (const text of visibleCopy) {
    for (const pattern of FORBIDDEN_TERMINAL_VISIBLE_TERMS) {
      if (pattern.test(text)) {
        matches.push({ text, pattern: pattern.toString() });
      }
    }
  }

  return matches;
}
