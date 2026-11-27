// 予測サービスの内部ページ (段階 ②・2026-11-27 田平氏「A' パスワード付き」) の入口の鍵。
//
// 数字は公開しない (CP の約束 forecast_ledger_to_forecast_app・内部用)。だから:
//   • パスワード (FORECAST_APP_PASSWORD) が設定されていなければ 404 (鍵が無いまま開かない)
//   • Basic 認証のパスワードが合わなければ 401
//   • 合っても検索に出さない (X-Robots-Tag: noindex, nofollow)
// ユーザー名は何でもよい (パスワードだけを見る)。比べ方は長さに依らない比較にする。
export const FORECAST_LAB_PATH = /^\/(ja|en)\/forecast-lab(\/|$)/;

export type GateResult = { ok: true } | { ok: false; status: 401 | 404 };

function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function checkForecastLab(authorization: string | null, password: string | undefined): GateResult {
  if (!password) return { ok: false, status: 404 };
  if (!authorization || !authorization.startsWith("Basic ")) return { ok: false, status: 401 };
  let decoded = "";
  try {
    decoded = atob(authorization.slice(6).trim());
  } catch {
    return { ok: false, status: 401 };
  }
  const given = decoded.includes(":") ? decoded.slice(decoded.indexOf(":") + 1) : "";
  return safeEqual(given, password) ? { ok: true } : { ok: false, status: 401 };
}
