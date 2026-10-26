import { revalidatePath, revalidateTag } from "next/cache";

import { CRON_SECRET_ENV_KEY, decideCronRefresh } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron バックストップ (2026-08-14 Phase 1・田平氏 GO)。
 * vercel.json の crons がセッションアンカー直後 (JST 05:12 / 07:40 / 12:12 /
 * 18:12 / 23:12) にこの route を叩き、home の feed キャッシュ (3600 s) を
 * purge する。Mac 側 push が失敗した回でも、Blob に届いている最新 feed を
 * アンカー直後に拾える。時間 revalidate の短縮への回帰は禁止 (ISR コスト
 * doctrine) — これは push/cron による点の purge であり面の短縮ではない。
 * 2026-10-26 段 1: 一覧系の時間での作り直しを 6 時間に延ばしたので、ここが
 * home・セッション一覧の主な作り直し経路になった。00:00 JST (日付の変わり目・
 * 速報帯の「当日/前日」) にも呼ぶ。市場データのタグで全ページの枠も新しくする。
 * env CRON_SECRET 未設定なら常に 404 (inert)。Vercel は CRON_SECRET 設定時、
 * cron 呼び出しへ `Authorization: Bearer <CRON_SECRET>` を自動付与する。
 */
export async function GET(request: Request) {
  const decision = decideCronRefresh(
    process.env[CRON_SECRET_ENV_KEY],
    request.headers.get("authorization"),
  );
  if (!decision.ok) {
    return Response.json(
      { ok: false, reason: decision.reason },
      { status: decision.status },
    );
  }
  for (const path of decision.paths) {
    revalidatePath(path);
  }
  // 2026-10-26 段 1: ページの種類ごとの作り直しとタグの合図
  for (const route of decision.routes ?? []) {
    revalidatePath(route, "page");
  }
  for (const tag of decision.tags ?? []) {
    revalidateTag(tag, "max");
  }
  return Response.json({
    ok: true,
    revalidated: decision.paths,
    routes: decision.routes ?? [],
    tags: decision.tags ?? [],
  });
}
