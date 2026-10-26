import { revalidateTag } from "next/cache";
import { after } from "next/server";

import {
  articleRecordTag,
  fetchArticleRecord,
  isArticleInflowV2Enabled,
} from "@/lib/articles/article-inflow-v2";
import {
  REVALIDATE_TOKEN_ENV_KEY,
  articleSlugsFromPaths,
  decideRevalidate,
  pagePathTag,
} from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * token 保護 on-demand revalidation (GO#2 追補・GO#3 まで inert)。
 * env LIVEMAKERS_REVALIDATE_TOKEN 未設定なら常に 404。
 * 呼出元 = sub-repo emission の公開イベント (GO#3 T6 で配線)。
 */
export async function POST(request: Request) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  const decision = decideRevalidate(
    process.env[REVALIDATE_TOKEN_ENV_KEY],
    request.headers.get("authorization"),
    payload,
  );
  if (!decision.ok) {
    return Response.json(
      { ok: false, reason: decision.reason },
      { status: decision.status },
    );
  }
  // 2026-10-26 (PR-A): 古いページを出しながら裏で作り直す。作り直しに失敗
  // しても前のページが残る (revalidatePath は即時に捨てるので 500 になった)
  for (const path of decision.paths) {
    revalidateTag(pagePathTag(path), "max");
  }
  // 2026-10-27 (段 2a): 記事ページはカタログ v2 の記録を期限なしで保存する。
  // 記事の合図で記録も古い扱いにし、応答のあとで読み直して取得キャッシュに
  // 入れておく — 公開直後の初めての表示が Blob の 403 に当たっても描けるように
  if (isArticleInflowV2Enabled()) {
    const slugs = articleSlugsFromPaths(decision.paths);
    for (const slug of slugs) {
      revalidateTag(articleRecordTag(slug), "max");
    }
    if (slugs.length > 0) {
      after(async () => {
        await Promise.all(slugs.map((slug) => fetchArticleRecord(slug)));
      });
    }
  }
  return Response.json({ ok: true, revalidated: decision.paths });
}
