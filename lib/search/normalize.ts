/**
 * サイト内検索の正規化 (2026-10-02 spec)。検索語と記事側の両方にこれだけを通す
 * = 正規化の正本は 1 つ。NFKC で全角英数・半角カナ・全角空白を寄せ、小文字化し、
 * 空白の連続を 1 つにする。
 */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}
