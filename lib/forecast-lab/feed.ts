// 予測サービスの内部ページ用の書き出し (台帳 repo の app_feed.json・schema lfa_v1) を読む。
//
// 台帳 repo (sition-jp/lvm-forecast-ledger) は非公開。読み取り専用の鍵 (FORECAST_LEDGER_READ_TOKEN) で
// GitHub の API から読む。数字は公開の repo (livemakers-site) に置かない (2026-11-27 田平氏「A'」)。
// 鍵が無い・読めない時は null (ページは「読めない」と出す)。毎回読み直す (cache: "no-store")。
import "server-only";

export const FEED_URL =
  "https://api.github.com/repos/sition-jp/lvm-forecast-ledger/contents/app_feed.json?ref=main";

export type BaseInfo = { start: string; end: string; days: number | null };
export type TodayItem = {
  asset: string; event: "turn" | "move"; event_ja: string; horizon: "7D" | "30D";
  probability: number; base_rate: number; diff_pt: number | null; text: string | null;
  due_at: string | null; model_version: string | null; base_info: BaseInfo | null;
};
export type Calib = { p: number; n: number; hits: number; rate: number };
export type ScoreGroup = {
  asset: string; event: string; horizon: string; scope: "all" | "natural"; resolved: number; hits: number;
  brier: number | null; brier_skill: number | string | null; calibration: Calib[] | null;
};
export type Recent = {
  resolved_on: string; forecast_date: string; asset: string; event: string; horizon: string;
  probability: number; base_rate: number; outcome: "hit" | "miss"; before_ledger: boolean;
};
export type CycleItem = { skill_id: string; name: string | null; scope: string; status: string; weather: string };
export type Totals = { sunny: number; cloudy: number; rain: number; missing: number };
export type Feed = {
  schema: "lfa_v1"; generated_at: string; internal_only: true;
  today: { forecast_date: string | null; items: TodayItem[] };
  landmark: { count: number; items: { indicator: string; lit_on: string; asset: string; direction: string | null }[] };
  cycle: { issue: string | null; week: string | null; due_at?: string; bootstrap?: boolean;
           totals?: Record<string, Totals> | null; items: CycleItem[] };
  scores: ScoreGroup[]; recent: Recent[];
  readiness: { live_natural_7d30d_resolved?: number; public_target?: number };
  chain: Record<string, { ok: boolean; rows: number; last_hash: string }>;
};

export async function loadForecastFeed(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Feed | null> {
  // 開発中だけ: 手元の書き出しファイルを読む (本番では使わない・画面の確かめ用)
  if (env.NODE_ENV !== "production" && env.FORECAST_FEED_FILE) {
    try {
      const { readFile } = await import("node:fs/promises");
      const feed = JSON.parse(await readFile(env.FORECAST_FEED_FILE, "utf-8")) as Feed;
      return feed && feed.schema === "lfa_v1" ? feed : null;
    } catch {
      return null;
    }
  }
  const token = env.FORECAST_LEDGER_READ_TOKEN;
  if (!token) return null;
  try {
    const res = await fetcher(FEED_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw+json",
                 "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const feed = (await res.json()) as Feed;
    return feed && feed.schema === "lfa_v1" ? feed : null;
  } catch {
    return null;
  }
}
