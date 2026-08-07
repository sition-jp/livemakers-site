import { revalidatePath } from "next/cache";

import { REVALIDATE_TOKEN_ENV_KEY, decideRevalidate } from "@/lib/revalidate";

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
  for (const path of decision.paths) {
    revalidatePath(path);
  }
  return Response.json({ ok: true, revalidated: decision.paths });
}
