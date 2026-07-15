import type { MarketDirection } from "./market-snapshot";

export function marketDirectionClass(
  direction: MarketDirection | null,
): string {
  if (direction === "up") return "text-status-up";
  if (direction === "down") return "text-status-down";
  return "text-text-secondary";
}
