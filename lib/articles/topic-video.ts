// watch?v= (クエリ順不同) / youtu.be / live / shorts。id は YouTube 仕様の 11 文字
const VIDEO_RE =
  /https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch\?(?:[^\s)\]"'<>]*&)?v=|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;

/**
 * 本文で最初に現れる YouTube 動画の id (無ければ null)。
 * 当事者の公式動画 1 本を肝ツイートの次の段落直後に埋め込むための決定論選定
 * (2026-10-04 田平氏 GO — 改善策 ④)。どの動画を出典に置くかは書き手の責務
 * (voice.md §2-9)。
 */
export function extractTopicVideoId(body: string): string | null {
  return VIDEO_RE.exec(body)?.[1] ?? null;
}
