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
 * 検証内容 (bytes は取得しない):
 * - atomic union: mirror 記事は thumbnail_url / thumbnail_checksum /
 *   thumbnail_doctrine="no_overlay" の 3 項目が揃うこと (1 つでも欠けたら無効)。
 *   site-first 記事は T4-2 契約 (url + checksum) を維持し doctrine は任意
 *   (存在する場合の値は zod が no_overlay に固定済み)
 * - exact origin: ARTICLE_THUMBNAIL_ORIGIN 配下の https URL のみ
 * - path checksum: ファイル名が `<sha256>.webp` (中身のハッシュ入りパス) なら、
 *   その値が thumbnail_checksum と一致すること
 *
 * 2026-10-17 (案 A1・田平氏 GO): 描画時の bytes checksum 照合を廃止した。
 * force-cache の検証 GET は、読む側ページの暗黙タグ (`_N_T_/ja` 等) が
 * revalidatePath されると Next の data cache 上で期限切れ扱いになる
 * (unstable_cache も同じ)。公開のたびに revalidate されたページの次の描画が
 * catalog 全件 (~500 枚 × ~400KB) を取り直し、Vercel の Blob 転送が
 * 1 日 ~$3.4 (12h で 46GB・User Agent node が 98%) に達していた。
 * bytes の照合は書き込み側が担う — sub-repo の mirror (create-only + readback
 * sha256) と site-first (PUT + readback sha256) が公開前に一致を確かめてから
 * catalog に thumbnail_checksum を載せる。読者のブラウザは Blob URL を直接
 * 読むため、描画時の照合は元々読者の見る画像を保証していなかった。
 * site-first の固定名パス (`thumbnail.webp`) はハッシュ入りパスへの移行
 * (sub-repo 側・A2) まで path checksum の対象外として受け入れる。
 * 設計: SITION core `08_DOCS/knowledge/specs/2026-10-17-lvm-thumbnail-verification-cost-fix-design.md`
 */

export type ThumbnailRejectReason =
  | "union_incomplete"
  | "origin_not_allowed"
  | "checksum_mismatch";

const HASH_NAMED_FILE = /^([0-9a-f]{64})\.webp$/;

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

function pathChecksumAgrees(url: string, checksum: string): boolean {
  const fileName = new URL(url).pathname.split("/").pop() ?? "";
  const match = HASH_NAMED_FILE.exec(fileName);
  return match === null || match[1] === checksum;
}

function rejectReason(article: ThumbnailCarrier): ThumbnailRejectReason | null {
  if (!unionComplete(article)) return "union_incomplete";
  if (!hasAllowedOrigin(article.thumbnail_url!)) return "origin_not_allowed";
  if (!pathChecksumAgrees(article.thumbnail_url!, article.thumbnail_checksum!)) {
    return "checksum_mismatch";
  }
  return null;
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

export function stripUnverifiedThumbnails<
  TItem extends ThumbnailCarrier,
  TFeed extends { articles: TItem[] },
>(feed: TFeed): TFeed {
  const articles = feed.articles.map((article) => {
    if (
      article.thumbnail_url === undefined
      && article.thumbnail_checksum === undefined
      && article.thumbnail_doctrine === undefined
    ) {
      return article;
    }
    const reason = rejectReason(article);
    if (reason === null) return article;
    console.warn(
      `[article-inflow] thumbnail rejected (${reason}); serving placeholder for slug=${article.slug}`,
    );
    return stripThumbnail(article);
  });
  return { ...feed, articles };
}
