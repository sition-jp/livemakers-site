/**
 * 金融再起動の現在地 (restart-map) の確定した段階 (2026-10-29 田平氏 GO)。
 * 右カラムとサイドバーの枠に「③ 旧システムの負荷 = 緊張 ／ ほか 6 系統は兆し〜実験」の
 * 1 行を添えるための表。
 *
 * - 正本 = SDE の `state/financial_restart/stages_confirmed.json` (田平氏が号の承認と
 *   一緒に確定)。号を公開したら、その号の articleId と段階をここに 1 件足す
 *   (core runbook 2026-10-26-financial-restart-monthly-issue)
 * - 表に無い号は 1 行を出さない (前の号の段階を新しい号に付けない)
 * - 公開面に台帳キー (payments 等) を出さない — 文字はすべてこの表の日本語
 * - 段階は 1〜4。③ だけ傷みを測るので段階名が別 (spec 2026-10-26 §4-1)
 */

export const RESTART_TRACKS = [
  { key: "payments", label: "① 決済" },
  { key: "reserves", label: "② 準備資産" },
  { key: "legacy_stress", label: "③ 旧システムの負荷" },
  { key: "tokenization", label: "④ 資産のトークン化" },
  { key: "off_bank", label: "⑤ 銀行の外へのお金の流れ" },
  { key: "institutions", label: "⑥ 制度" },
  { key: "machine_economy", label: "⑦ 機械どうしの経済" },
] as const;

export type RestartTrackKey = (typeof RESTART_TRACKS)[number]["key"];
export type RestartStage = 1 | 2 | 3 | 4;
export type RestartStages = Record<RestartTrackKey, RestartStage>;

const STRESS_TRACK: RestartTrackKey = "legacy_stress";
const GROWTH_STAGE_NAMES = ["兆し", "実験", "制度化", "置き換え"] as const;
const STRESS_STAGE_NAMES = ["余裕", "負荷", "緊張", "機能不全"] as const;

export const CONFIRMED_RESTART_STAGES: Readonly<Record<string, RestartStages>> = {
  // #1 (2026-10-26 確定)
  "restart-map-20261026-3539f54e": {
    payments: 1,
    reserves: 2,
    legacy_stress: 3,
    tokenization: 2,
    off_bank: 2,
    institutions: 2,
    machine_economy: 1,
  },
};

export function restartStageSummary(
  articleId: string,
  table: Readonly<Record<string, Readonly<Record<string, number>>>> = CONFIRMED_RESTART_STAGES,
): string | null {
  const stages = table[articleId];
  if (!stages) return null;

  const stress = RESTART_TRACKS.find((track) => track.key === STRESS_TRACK)!;
  const growth = RESTART_TRACKS.filter((track) => track.key !== STRESS_TRACK).map(
    (track) => stages[track.key],
  );
  const low = GROWTH_STAGE_NAMES[Math.min(...growth) - 1];
  const high = GROWTH_STAGE_NAMES[Math.max(...growth) - 1];
  const range = low === high ? low : `${low}〜${high}`;

  return `${stress.label} = ${STRESS_STAGE_NAMES[stages[STRESS_TRACK] - 1]} ／ ほか ${growth.length} 系統は${range}`;
}
