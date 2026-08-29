const STATUS_RE =
  /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)/g;

// 自社アカウントのポストは「外部一次ソース」でない (SIPO Phase 1 と同判断)
const OWN_HANDLES = new Set(["sitionjp", "sipo_tokyo", "lifemakerscom"]);

/**
 * 本文で最初に現れる外部アカウントの X status ID (無ければ null)。
 * 記事の肝ツイート 1 本をリード直後に埋め込むための決定論選定
 * (2026-08-14 田平氏 GO — 3 サイト展開の Phase 2)。
 */
export function extractTopicTweetId(body: string): string | null {
  for (const m of body.matchAll(STATUS_RE)) {
    if (OWN_HANDLES.has(m[1].toLowerCase())) continue;
    return m[2];
  }
  return null;
}
