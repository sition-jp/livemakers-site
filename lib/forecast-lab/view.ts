// 予測サービスの内部ページの言葉の決まり (core 2026-11-27-lvm-forecast-app-stage2-design.md §2・「ふだん」の決まり)。
// 確率の予報は「当たり・外れ」と書かず「起きた・起きなかった」。ふだん = 過去の平均 (期間と日数を添える)。
import type { BaseInfo, Calib, TodayItem } from "./feed";

export const HORIZON_JA: Record<string, string> = { "7D": "7 日以内", "30D": "30 日以内" };
const SIZE_JA: Record<string, string> = { "7D": "小さめ (5% 以上)", "30D": "中くらい (15% 以上)" };

export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
export const md = (d: string | null | undefined) => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : "—");
export const ym = (d: string) => `${d.slice(0, 4)} 年 ${+d.slice(5, 7)} 月`;

export function questionName(i: Pick<TodayItem, "asset" | "event" | "horizon">): string {
  return i.event === "turn"
    ? `${i.asset} に ${HORIZON_JA[i.horizon]}に${SIZE_JA[i.horizon]}の天井か底が付く`
    : `${i.asset} が ${HORIZON_JA[i.horizon]}に大きく動く`;
}

export function compareWord(diffPt: number | null): { tone: "hi" | "lo" | "same"; word: string } {
  if (diffPt == null) return { tone: "same", word: "ふだんとの差 —" };
  if (diffPt >= 5) return { tone: "hi", word: "ふだんより高い" };
  if (diffPt <= -5) return { tone: "lo", word: "ふだんより低い" };
  return { tone: "same", word: "ふだんと同じくらい" };
}

export function usualLine(b: BaseInfo | null): string {
  if (!b || b.days == null) return "ふだんの確率の期間の記録がありません";
  return `ふだんの確率 = ${ym(b.start)}〜${ym(b.end)}の ${b.days.toLocaleString("ja-JP")} 日のうち、この出来事が実際に起きた日の割合`;
}

/** 先頭の 1 行: いちばん「ふだん」と違う問い (差が 5 ポイント未満なら null = 「どれもふだんと同じくらい」). */
export function leadItem(items: TodayItem[]): TodayItem | null {
  const withDiff = items.filter((i) => i.diff_pt != null);
  if (!withDiff.length) return null;
  const top = [...withDiff].sort((a, b) => Math.abs(b.diff_pt!) - Math.abs(a.diff_pt!))[0];
  return Math.abs(top.diff_pt!) >= 5 ? top : null;
}

/** 較正の点から「AI の平均の確率」(件数で重み付け)。点が無ければ null. */
export function averageProbability(c: Calib[] | null): number | null {
  if (!c || !c.length) return null;
  const n = c.reduce((a, x) => a + x.n, 0);
  return n ? c.reduce((a, x) => a + x.p * x.n, 0) / n : null;
}
