import { PROPOSER_CONFIG } from "@/lib/proposer/config";
import type { PreferredHorizon } from "@/lib/intents";

export type Direction = "positive" | "negative" | "neutral" | "mixed";

export interface BuildInvalidationArgs {
  primaryAsset: string;
  direction: Direction;
  horizon: PreferredHorizon;
  outcomeSummary: string;
  currentPrice?: number;
  expiresAt: string; // ISO
}

export interface BuildInvalidationResult {
  text: string;
  usedPlaceholder: boolean;
}

function formatPrice(price: number): string {
  // Smart formatting: < 10 uses 3 decimals, 10-999 uses 2 decimals, else integer
  if (price < 10) return `$${price.toFixed(3)}`;
  if (price < 1000) return `$${price.toFixed(2)}`;
  return `$${Math.round(price)}`;
}

function extractDate(iso: string): string {
  return iso.split("T")[0];
}

/**
 * Build invalidation thesis text with market price injection or placeholder fallback.
 *
 * Market price path (currentPrice provided): generates `${asset} が ${threshold} を
 * 下抜ける/上抜ける、または ${date} までに ${outcome} が実現しない場合は仮説破棄`.
 *
 * Placeholder fallback (currentPrice undefined): generates `<<MANUAL: ...>>` token
 * that forces the human reviewer to replace it before the approve CLI will allow
 * publish (see createProposedIntent warnings.placeholderPresent).
 *
 * Spec §4.5 / Task 2-2 v0.2-alpha
 */
export function buildInvalidation(
  args: BuildInvalidationArgs,
): BuildInvalidationResult {
  const date = extractDate(args.expiresAt);
  const threshold = PROPOSER_CONFIG.threshold_pct[args.horizon];

  // Fallback: no price data
  if (args.currentPrice === undefined) {
    const text =
      `<<MANUAL: ${args.primaryAsset} 固有の無効化条件 (価格 or 観測イベント)>>、` +
      `または ${date} までに ${args.outcomeSummary} が実現しない場合は仮説破棄`;
    return { text, usedPlaceholder: true };
  }

  // Market price injection
  if (args.direction === "positive") {
    const trigger = formatPrice(args.currentPrice * (1 - threshold));
    const text =
      `${args.primaryAsset} が ${trigger} を下抜ける、` +
      `または ${date} までに ${args.outcomeSummary} が実現しない場合は仮説破棄`;
    return { text, usedPlaceholder: false };
  }

  if (args.direction === "negative") {
    const trigger = formatPrice(args.currentPrice * (1 + threshold));
    const text =
      `${args.primaryAsset} が ${trigger} を上抜ける、` +
      `または ${date} までに ${args.outcomeSummary} が実現しない場合は仮説破棄`;
    return { text, usedPlaceholder: false };
  }

  // neutral / mixed: bi-directional
  const lower = formatPrice(args.currentPrice * (1 - threshold));
  const upper = formatPrice(args.currentPrice * (1 + threshold));
  const text =
    `${args.primaryAsset} が ${lower} を下抜ける、または ${upper} を上抜ける、` +
    `または ${date} までに ${args.outcomeSummary} が実現しない場合は仮説破棄`;
  return { text, usedPlaceholder: false };
}
