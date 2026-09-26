/**
 * Human-readable state derivation for the Turning Point UI (spec 2026-09-26 §5.6 R1/R4).
 * Pure functions over existing snapshot fields — never changes producer scores.
 */
import { scoreLevel, type DirectionBias, type ScoreLevel } from "./types";

export type StateDriver = "price" | "volatility" | "mixed";
export type StateDirection = "up" | "down" | "flat";

export interface StateDescription {
  level: ScoreLevel;
  driver: StateDriver;
  direction: StateDirection;
  /** Direction is only meaningful once some turning-point condition is lit. */
  showDirection: boolean;
}

/** bullish − bearish must reach this many points before we call a direction. */
export const DIRECTION_GAP = 25;
/** |volatility_pivot − price_pivot| at or below this is reported as "mixed". */
export const DRIVER_TIE = 10;

export function describeState(input: {
  overall: number;
  price_pivot: number;
  volatility_pivot: number;
  direction_bias?: DirectionBias | null;
  main_signal?: StateDriver | null;
}): StateDescription {
  const level = scoreLevel(input.overall);
  let driver: StateDriver;
  if (input.main_signal) {
    driver = input.main_signal;
  } else {
    const gap = input.volatility_pivot - input.price_pivot;
    driver = Math.abs(gap) <= DRIVER_TIE ? "mixed" : gap > 0 ? "volatility" : "price";
  }
  let direction: StateDirection = "flat";
  if (input.direction_bias) {
    const d = input.direction_bias.bullish - input.direction_bias.bearish;
    if (d >= DIRECTION_GAP) direction = "up";
    else if (d <= -DIRECTION_GAP) direction = "down";
  }
  return { level, driver, direction, showDirection: level !== "Low" };
}

export function scoreDelta(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined) return null;
  return Math.round(current) - Math.round(previous);
}
