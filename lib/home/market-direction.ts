import type { MarketDirection } from "./market-snapshot";

export function marketDirectionClass(
  direction: MarketDirection | null,
): string {
  if (direction === "up") return "text-market-up";
  if (direction === "down") return "text-market-down";
  return "text-text-secondary";
}
