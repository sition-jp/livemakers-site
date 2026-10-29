// 新しい確率の画面を出すかどうかの判定 (it-2026-10 段 3・作業 13d)。
import type { AssetSymbol, PivotAssetsSnapshot } from "./types";

/** 資産ごとの条件: forecast が 1 件以上あり、かつ forecast_history がある。 */
export function hasForecastScreen(
  snapshot: PivotAssetsSnapshot | null | undefined,
  asset: AssetSymbol,
): boolean {
  if (!snapshot) return false;
  return (snapshot.forecast?.[asset]?.length ?? 0) > 0 && snapshot.forecast_history?.[asset] !== undefined;
}

/** 一覧: radar の全資産が条件を満たすときだけ新しい画面 (混在させない)。 */
export function allForecastScreen(snapshot: PivotAssetsSnapshot | null | undefined): boolean {
  if (!snapshot || snapshot.radar.length === 0) return false;
  return snapshot.radar.every((a) => hasForecastScreen(snapshot, a.symbol));
}

/** 「今」の終値 = forecast_history の最後の close。無ければ null。 */
export function nowCloseOf(snapshot: PivotAssetsSnapshot, asset: AssetSymbol): number | null {
  const h = snapshot.forecast_history?.[asset] ?? [];
  for (let i = h.length - 1; i >= 0; i--) {
    const c = h[i].close;
    if (c !== undefined) return c;
  }
  return null;
}
