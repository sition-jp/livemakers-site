/**
 * AI ボットなどの来訪の記録 (2026-11-15 田平氏 GO・spec
 * 08_DOCS/knowledge/specs/2026-11-15-lvm-ai-bot-policy-and-visit-metrics-design.md §7-4)。
 *
 * - `proxy.ts` が応答を返したあと (`event.waitUntil`) に 1 来訪 1 行を送る。
 * - 人の閲覧 (User-Agent がボットに当たらない) は何も作らず、何も送らない。
 * - 送信の失敗は握りつぶす。ページの応答には決して影響させない。
 * - 受け口の合言葉 (`BOT_VISIT_INGEST_TOKEN`) は Authorization ヘッダにだけ載せる。
 *   本文・ログ・エラー出力には出さない (このファイルは console を一切使わない)。
 * - User-Agent だけの判定なので偽装されうる。「確認済みの AI の来訪」ではない。
 */

import { classifyUserAgent, type BotCategory } from "./ai-bots";

/** 記録だけして、言語の振り分けを通さずにそのまま返すファイル。 */
export const RECORDED_FILES = [
  "/robots.txt",
  "/llms.txt",
  "/sitemap.xml",
  "/sitemap-news.xml",
] as const;

export interface BotVisit {
  site: "livemakers";
  bot: string;
  category: BotCategory;
  kind: "page" | "redirect" | "file";
  /** この 1 行が何件分か (間引いた種類は rate・全件の種類は 1)。 */
  sample: number;
  path: string;
  ua: string;
}

type Env = Record<string, string | undefined>;

/**
 * Cloudflare 無料プランの上限 (アカウント全体で 1 日 10 万件) を守るため、
 * AI 以外の種類は間引く (spec §7-4b)。AI の種類 (training・search・user_fetch) は全件。
 */
const SAMPLED_CATEGORIES: ReadonlySet<BotCategory> = new Set<BotCategory>([
  "search_engine",
  "preview",
  "other_bot",
]);

const DEFAULT_SAMPLE_RATE = 10;
const MAX_LEN = 200;
const SEND_TIMEOUT_MS = 2000;

function sampleRate(env: Env): number {
  const raw = env.BOT_VISIT_SAMPLE_RATE;
  if (raw === undefined || !/^[0-9]+$/.test(raw)) return DEFAULT_SAMPLE_RATE;
  const n = Number(raw);
  return n >= 1 && n <= 1000 ? n : DEFAULT_SAMPLE_RATE;
}

/**
 * 記録する 1 行を作る。記録しないとき (GET/HEAD 以外・Next の先読み・人・
 * 間引きで外れた) は null。
 */
export function buildBotVisit(
  req: Request,
  kind: BotVisit["kind"],
  env: Env,
  random: () => number = Math.random,
): BotVisit | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;

  const url = new URL(req.url);
  // Next.js の先読み (?_rsc= か RSC: 1) はページを読んだ回数を膨らませるので数えない。
  if (url.searchParams.has("_rsc") || req.headers.get("rsc") === "1") return null;

  const ua = req.headers.get("user-agent");
  const hit = classifyUserAgent(ua);
  if (!hit || !ua) return null;

  let sample = 1;
  if (SAMPLED_CATEGORIES.has(hit.category)) {
    sample = sampleRate(env);
    if (!(random() < 1 / sample)) return null;
  }

  return {
    site: "livemakers",
    bot: hit.bot,
    category: hit.category,
    kind,
    sample,
    path: url.pathname.slice(0, MAX_LEN),
    ua: ua.slice(0, MAX_LEN),
  };
}

/**
 * 1 行を受け口へ送る。止められている・送り先か合言葉が無い (開発・プレビュー)
 * ときは何もしない。どんな失敗でも reject しない。
 */
export async function sendBotVisit(
  visit: BotVisit,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    if (env.BOT_VISIT_INGEST_ENABLED === "0") return;
    const url = env.BOT_VISIT_INGEST_URL;
    const token = env.BOT_VISIT_INGEST_TOKEN;
    if (!url || !token) return;

    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(visit),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    // 応答の中身は使わない。読まずに閉じる。
    await res.body?.cancel().catch(() => {});
  } catch {
    // 握りつぶす (ログも出さない — エラー文に合言葉が混ざる可能性を残さない)。
  }
}
