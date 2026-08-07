import { createHash, timingSafeEqual } from "node:crypto";

/**
 * on-demand revalidation の判定 (GO#2 追補・2026-08-01 論点の履行)。
 *
 * ISR コスト対応 (site PR #45) で feed cache が 3600s になり、新記事の
 * サイト反映が最大 ~1h 遅れうる。公開イベント側 (sub-repo emission・GO#3
 * T6) がこの route を叩いて対象 path だけ即時 revalidate する。
 * 時間 revalidate の短縮への回帰は禁止 (コスト穴の再開になる)。
 *
 * env LIVEMAKERS_REVALIDATE_TOKEN 未設定の間は 404 で完全 inert —
 * provisioning (GO#3 前) まで挙動ゼロ。
 */
export const REVALIDATE_TOKEN_ENV_KEY = "LIVEMAKERS_REVALIDATE_TOKEN";

const MAX_PATHS = 50;
// 許可 path = locale 直下 / 記事一覧 / series / 記事詳細のみ
const PATH_RE = /^\/(ja|en)(\/articles(\/series\/[a-z0-9-]+|\/[a-z0-9-]+)?)?$/;

export type RevalidateDecision =
  | { ok: true; paths: string[] }
  | { ok: false; status: number; reason: string };

function tokensMatch(candidate: string, configured: string): boolean {
  // 長さ差でも一定時間比較になるよう hash 同士を比較する
  const left = createHash("sha256").update(candidate, "utf8").digest();
  const right = createHash("sha256").update(configured, "utf8").digest();
  return timingSafeEqual(left, right);
}

export function decideRevalidate(
  configuredToken: string | undefined,
  authorizationHeader: string | null,
  payload: unknown,
): RevalidateDecision {
  if (!configuredToken) {
    return { ok: false, status: 404, reason: "route_disabled" };
  }
  const bearer = (authorizationHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer || !tokensMatch(bearer, configuredToken)) {
    return { ok: false, status: 401, reason: "invalid_token" };
  }
  const paths = (payload as { paths?: unknown } | null)?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS) {
    return { ok: false, status: 400, reason: "invalid_paths" };
  }
  const normalized: string[] = [];
  for (const path of paths) {
    if (typeof path !== "string" || !PATH_RE.test(path)) {
      return { ok: false, status: 400, reason: "invalid_path" };
    }
    normalized.push(path);
  }
  return { ok: true, paths: [...new Set(normalized)] };
}
