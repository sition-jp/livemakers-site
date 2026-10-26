import { createHash, timingSafeEqual } from "node:crypto";

import { TERMINAL_FEED_CACHE_TAG } from "@/lib/terminal/live-market-feed";

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
// 許可 path = locale 直下 / 記事一覧 / series / 記事詳細 / セッション
// (archive + 詳細)。sessions は 2026-08-14 Phase 1 で追加 — セッション
// ライフサイクル (crystallize 着地・live 切替) にも on-demand purge 経路を持たせる。
const PATH_RE =
  /^\/(ja|en)(\/articles(\/series\/[a-z0-9-]+|\/[a-z0-9-]+)?|\/sessions(\/archive|\/[a-z0-9-]+)?)?$/;

/**
 * 2026-10-26 段 1 (設計書 2026-10-26-lvm-lmk-vercel-cost-on-demand-and-catalog-split-design):
 * 記事カタログを読む一覧系ページの「種類」。記事の公開・訂正・取り下げの合図
 * (記事の path を含む payload) を受けたら、`revalidatePath(route, "page")` で
 * その種類のページを丸ごと作り直す (次のアクセス時に 1 回だけ)。カタログは
 * 1.6MB でデータキャッシュに載らず、fetch のタグがページに記録されないため、
 * タグではなく Next.js がページの種類ごとに付ける印で合図する (2026-10-26 実測)。
 * 記事詳細の種類は含めない — 公開レーンが記事ごとの path を送る。
 * 後半の 4 つは「最新記事」の欄 (loadLatestArticlesRail) を持つページ。
 */
export const ARTICLE_LISTING_ROUTES = [
  "/[locale]",
  "/[locale]/articles/today",
  "/[locale]/articles/series/[series]",
  "/[locale]/articles/series/[series]/page/[page]",
  "/[locale]/about",
  "/[locale]/sessions/archive",
  "/[locale]/sessions/archive/past",
  "/[locale]/future-atlas",
] as const;

/** 記事カタログから作る RSS・sitemap (記事の合図で一緒に作り直す)。 */
export const ARTICLE_FEED_PATHS = [
  "/sitemap.xml",
  "/sitemap-news.xml",
  "/ja/feed.xml",
  "/ja/feed",
] as const;

const ARTICLE_PATH_RE = /^\/(ja|en)\/articles(\/|$)/;

export type RevalidateDecision =
  | {
      ok: true;
      paths: string[];
      /** `revalidatePath(route, "page")` で作り直すページの種類 */
      routes?: string[];
      /** `revalidateTag(tag, "max")` で合図するタグ */
      tags?: string[];
    }
  | { ok: false; status: number; reason: string };

export function tokensMatch(candidate: string, configured: string): boolean {
  // 長さ差でも一定時間比較になるよう hash 同士を比較する
  const left = createHash("sha256").update(candidate, "utf8").digest();
  const right = createHash("sha256").update(configured, "utf8").digest();
  return timingSafeEqual(left, right);
}

/**
 * Vercel Cron バックストップの判定 (2026-08-14 Phase 1)。
 * アンカー直後に home の feed キャッシュを purge する保険経路 —
 * Mac 側の push (deliver 後の on-demand revalidate) が失敗しても、
 * アップロード済みの最新 Blob を次のアンカー描画までに拾えるようにする。
 * CRON_SECRET 未設定の間は 404 で完全 inert (revalidate route と同じ流儀)。
 * Vercel は CRON_SECRET が設定されていると cron 呼び出しに
 * `Authorization: Bearer <CRON_SECRET>` を自動付与する。
 */
export const CRON_SECRET_ENV_KEY = "CRON_SECRET";

export function decideCronRefresh(
  configuredSecret: string | undefined,
  authorizationHeader: string | null,
): RevalidateDecision {
  if (!configuredSecret) {
    return { ok: false, status: 404, reason: "route_disabled" };
  }
  const bearer = (authorizationHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer || !tokensMatch(bearer, configuredSecret)) {
    return { ok: false, status: 401, reason: "invalid_token" };
  }
  // 2026-10-26 段 1: 時間での作り直しを 6 時間に延ばしたので、セッション時刻と
  // 0 時にここで home + セッション一覧を作り直す。市場データのタグで、全ページの
  // 共通の枠 (ティッカー) も次のアクセス時に新しくする
  return {
    ok: true,
    paths: ["/ja", "/en", "/ja/sessions/archive", "/en/sessions/archive"],
    tags: [TERMINAL_FEED_CACHE_TAG],
  };
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
  // 記事の path を含む = 記事カタログが変わった合図 (公開レーンは必ず
  // /ja/articles を送る)。市場データの配信は /ja・/en・セッションだけなので広げない
  if (normalized.some((path) => ARTICLE_PATH_RE.test(path))) {
    return {
      ok: true,
      paths: [...new Set([...normalized, ...ARTICLE_FEED_PATHS])],
      routes: [...ARTICLE_LISTING_ROUTES],
    };
  }
  return { ok: true, paths: [...new Set(normalized)] };
}
