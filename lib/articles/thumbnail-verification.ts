import { createHash } from "node:crypto";

import {
  ARTICLE_THUMBNAIL_DOCTRINE,
  ARTICLE_THUMBNAIL_ORIGIN,
} from "@/lib/articles/article-inflow-validation.mjs";

// FEEDSPLIT T6: v0 feed item / catalog v1 item (body なし) の両方を受けるため
// サムネ検証が実際に読む field だけの構造型で generic 化する
type ThumbnailCarrier = {
  slug: string;
  source_x_url?: unknown;
  thumbnail_url?: string;
  thumbnail_checksum?: string;
  thumbnail_doctrine?: typeof ARTICLE_THUMBNAIL_DOCTRINE;
};

/**
 * サムネ検証 (P2-LVM-INFLOW-G2 D3・T1a)。
 *
 * feed のサムネ宣言を記事単位で検証し、通らない記事は **サムネ 3 項目だけを
 * 剥がして記事本体は生存させる** (局所 degradation・feed 全体を reject しない)。
 * 無音 skip にしない — 剥がした理由は console.warn で観測可能にする。
 *
 * 検証内容:
 * - atomic union: mirror 記事は thumbnail_url / thumbnail_checksum /
 *   thumbnail_doctrine="no_overlay" の 3 項目が揃うこと (1 つでも欠けたら無効)。
 *   site-first 記事は T4-2 契約 (url + checksum) を維持し doctrine は任意
 *   (存在する場合の値は zod が no_overlay に固定済み)
 * - exact origin: ARTICLE_THUMBNAIL_ORIGIN 配下の https URL のみ。redirect 不可
 * - checksum: 取得した bytes の sha256 が thumbnail_checksum と一致すること
 *
 * 検証 GET は `url?sha256=<checksum>` を Next Data Cache に永続化する。
 * stable pathname が上書きされても checksum が変われば新しい cache key で
 * 再検証し、同じ bytes は ISR の 5 分周期で再取得しない。プロセス内でも
 * `url#checksum` キーで memoize する。
 *
 * 2026-09-27 (同時描画バースト): catalog を読む描画ごとに全件 (~420 本) を
 * 検証するため、記事ページの再生成が重なると検証 GET が数百〜千件同時に
 * 走り、接続タイムアウト / ECONNRESET で約 1 割が落ちた (3 描画同時 =
 * 1,257 本中 134 本失敗・ローカル再現)。落ちた記事は placeholder のまま
 * ISR に最大 1 時間焼き付く (DD 0829 / 0903 / 0921 の JA ページで実測)。
 * そこで (1) 同じ `url#checksum` の検証は in-flight を共有し、(2) プロセス
 * 全体の同時 GET を THUMBNAIL_VERIFICATION_CONCURRENCY 本に抑え、(3) 取得
 * レベルの失敗だけ 1 回再試行する (checksum 不一致は再試行しない)。
 * 検証の厳しさ (origin / union / bytes checksum) は変えない。
 */

export type ThumbnailRejectReason =
  | "union_incomplete"
  | "origin_not_allowed"
  | "fetch_failed"
  | "checksum_mismatch";

export const THUMBNAIL_VERIFICATION_CONCURRENCY = 12;
export const THUMBNAIL_VERIFICATION_FETCH_ATTEMPTS = 2;

const verifiedCache = new Map<string, boolean>();
const inFlightVerifications = new Map<string, Promise<ThumbnailRejectReason | null>>();

let activeVerificationFetches = 0;
const verificationFetchWaiters: Array<() => void> = [];

async function withVerificationSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeVerificationFetches >= THUMBNAIL_VERIFICATION_CONCURRENCY) {
    // 解放側がスロットを直接譲る (active は据え置き) — 起床までの間に
    // 新規呼出が割り込んで上限を超えることがない
    await new Promise<void>((resolve) => verificationFetchWaiters.push(resolve));
  } else {
    activeVerificationFetches += 1;
  }
  try {
    return await run();
  } finally {
    const next = verificationFetchWaiters.shift();
    if (next) next();
    else activeVerificationFetches -= 1;
  }
}

function hasAllowedOrigin(url: string): boolean {
  return url.startsWith(`${ARTICLE_THUMBNAIL_ORIGIN}/`);
}

function unionComplete(article: ThumbnailCarrier): boolean {
  const isMirror = "source_x_url" in article;
  if (article.thumbnail_url === undefined || article.thumbnail_checksum === undefined) {
    return false;
  }
  if (isMirror && article.thumbnail_doctrine !== ARTICLE_THUMBNAIL_DOCTRINE) {
    return false;
  }
  return true;
}

async function verifyThumbnailBytes(
  url: string,
  checksum: string,
  fetcher: typeof fetch,
): Promise<ThumbnailRejectReason | null> {
  const cacheKey = `${url}#${checksum}`;
  const cached = verifiedCache.get(cacheKey);
  if (cached !== undefined) return cached ? null : "checksum_mismatch";
  const inFlight = inFlightVerifications.get(cacheKey);
  if (inFlight) return inFlight;
  const verification = withVerificationSlot(
    () => fetchAndVerifyThumbnail(url, checksum, fetcher),
  ).then((reason) => {
    // 取得失敗は一時要因でありうるので memoize しない (翌 revalidate で再試行)
    if (reason !== "fetch_failed") verifiedCache.set(cacheKey, reason === null);
    return reason;
  }).finally(() => {
    inFlightVerifications.delete(cacheKey);
  });
  inFlightVerifications.set(cacheKey, verification);
  return verification;
}

async function fetchAndVerifyThumbnail(
  url: string,
  checksum: string,
  fetcher: typeof fetch,
): Promise<ThumbnailRejectReason | null> {
  const verificationUrl = new URL(url);
  verificationUrl.searchParams.set("sha256", checksum);
  for (let attempt = 1; attempt <= THUMBNAIL_VERIFICATION_FETCH_ATTEMPTS; attempt += 1) {
    let bytes: Buffer;
    try {
      const response = await fetcher(verificationUrl.toString(), {
        cache: "force-cache",
        redirect: "error",
      });
      if (!response.ok) continue;
      bytes = Buffer.from(await response.arrayBuffer());
    } catch {
      continue;
    }
    // bytes が取れた時点で判定確定 — 不一致は再試行しても変わらない
    const digest = createHash("sha256").update(bytes).digest("hex");
    return digest === checksum ? null : "checksum_mismatch";
  }
  return "fetch_failed";
}

function stripThumbnail<TItem extends ThumbnailCarrier>(article: TItem): TItem {
  const {
    thumbnail_url: _url,
    thumbnail_checksum: _checksum,
    thumbnail_doctrine: _doctrine,
    ...rest
  } = article;
  return rest as TItem;
}

/** テスト用: memoize を破棄する */
export function clearThumbnailVerificationCache(): void {
  verifiedCache.clear();
  inFlightVerifications.clear();
}

export async function stripUnverifiedThumbnails<
  TItem extends ThumbnailCarrier,
  TFeed extends { articles: TItem[] },
>(feed: TFeed, fetcher: typeof fetch = fetch): Promise<TFeed> {
  const articles = await Promise.all(
    feed.articles.map(async (article) => {
      if (
        article.thumbnail_url === undefined
        && article.thumbnail_checksum === undefined
        && article.thumbnail_doctrine === undefined
      ) {
        return article;
      }
      let reason: ThumbnailRejectReason | null = null;
      if (!unionComplete(article)) {
        reason = "union_incomplete";
      } else if (!hasAllowedOrigin(article.thumbnail_url!)) {
        reason = "origin_not_allowed";
      } else {
        reason = await verifyThumbnailBytes(
          article.thumbnail_url!,
          article.thumbnail_checksum!,
          fetcher,
        );
      }
      if (reason === null) return article;
      console.warn(
        `[article-inflow] thumbnail rejected (${reason}); serving placeholder for slug=${article.slug}`,
      );
      return stripThumbnail(article);
    }),
  );
  return { ...feed, articles };
}
