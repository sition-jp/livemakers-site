import { after } from "next/server";

import { articleSlugsFromPaths } from "@/lib/revalidate";
import { SITE_URL } from "@/lib/site";

/**
 * IndexNow (2026-11-10 田平氏 GO — サイト流入 第 1 段 1-2)。
 *
 * 記事の公開・更新の合図 (/api/revalidate) を受けたら、その記事の URL を
 * IndexNow に知らせる。受け取るのは Bing・Yandex・Naver・Seznam・Yep など
 * (Google は参加していない)。LMK では Bing からの訪問が Google の約 5 倍
 * あり、Bing は Copilot の元にもなる。
 *
 * 鍵は秘密ではない: 「このサイトの持ち主が送った」ことを、同じ鍵を
 * public/<鍵>.txt に置くことで示す仕様。サイトごとに別の鍵を使う。
 */
export const INDEXNOW_KEY = "3a36e6e1989f8ba0c1d4b884ee15b4ff";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const MAX_URLS_PER_SUBMISSION = 100;
const TIMEOUT_MS = 5000;

/**
 * 合図の path から、知らせる URL を作る。正規 URL (/ja/articles/<slug>) だけ。
 * /en は英語の本文が無く日本語の本文をそのまま出すので送らない。一覧・トップも
 * 送らない (巡回で足りる)。
 */
export function indexNowUrlsFromPaths(paths: readonly string[]): string[] {
  const jaPaths = paths.filter((path) => path.startsWith("/ja/"));
  return articleSlugsFromPaths(jaPaths)
    .slice(0, MAX_URLS_PER_SUBMISSION)
    .map((slug) => `${SITE_URL}/ja/articles/${slug}`);
}

export type IndexNowResult = { sent: number; status: number | null };

/**
 * IndexNow へ送る。本番 (VERCEL_ENV === "production") 以外では送らない —
 * プレビューや手元のビルドから本番の URL を知らせないため。throw しない:
 * 送信は「知らせ」であって、失敗しても記事の公開には関係がない。
 */
export async function submitIndexNow(
  urls: readonly string[],
  opts: { fetchImpl?: typeof fetch; env?: string | undefined } = {},
): Promise<IndexNowResult> {
  const env = "env" in opts ? opts.env : process.env.VERCEL_ENV;
  if (env !== "production" || urls.length === 0) return { sent: 0, status: null };
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: [...urls],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // 403 = 鍵ファイルを確かめられない・422 = URL と host が合わない・429 = 送りすぎ。
      // 失敗は応答には出さないが、気づけるようログに 1 行残す
      console.warn(`[indexnow] not accepted: status=${response.status} urls=${urls.length}`);
    }
    return { sent: response.ok ? urls.length : 0, status: response.status };
  } catch (error) {
    console.warn(`[indexnow] request failed: ${error instanceof Error ? error.name : "unknown"} urls=${urls.length}`);
    return { sent: 0, status: null };
  }
}

/**
 * 合図の応答を返したあとで送る (応答を遅らせない)。記事の path が無ければ
 * 何も予約しない。
 */
export function notifyIndexNowAfterResponse(paths: readonly string[]): void {
  const urls = indexNowUrlsFromPaths(paths);
  if (urls.length === 0) return;
  after(async () => {
    await submitIndexNow(urls);
  });
}
