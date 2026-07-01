import { describe, expect, it } from "vitest";
import { terminalPreviewAdapterFixtureMock } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";

const FORBIDDEN_VISIBLE_TERMS = [
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

describe("terminalPreviewMock", () => {
  it("marks every module as static mock data and keeps real connections closed", () => {
    expect(terminalPreviewAdapterFixtureMock.routePolicy.hidden).toBe(true);
    expect(terminalPreviewAdapterFixtureMock.routePolicy.navLink).toBe(false);
    expect(terminalPreviewAdapterFixtureMock.routePolicy.noindex).toBe(true);

    for (const module of terminalPreviewAdapterFixtureMock.modules) {
      expect(module.sourceKind).toMatch(/^(mock|fixture_only)$/);
      expect(module.publicDisplaySafety).toBe("mock_only");
      expect(module.realDataConnection).toBe(false);
      expect(module.prohibitedCouplingsChecked).toEqual({
        tradingSignal: true,
        orderInstruction: true,
        paperLive: true,
        atFeedback: true,
        secrets: true,
      });
    }
  });

  it("keeps visible mock copy away from trading and execution language", () => {
    const visibleStrings = collectStrings(terminalPreviewAdapterFixtureMock.visibleCopy);

    for (const text of visibleStrings) {
      for (const forbidden of FORBIDDEN_VISIBLE_TERMS) {
        expect(text, `${text} matched ${forbidden}`).not.toMatch(forbidden);
      }
    }
  });
});
