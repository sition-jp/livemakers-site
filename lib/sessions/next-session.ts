import { READER_SESSIONS, type ReaderSessionDef } from "./session-registry";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JST "HH:MM" for the given instant. Pure — inject now. */
function jstHhMm(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(11, 16);
}

export interface NextSession {
  def: ReaderSessionDef;
  /** "tomorrow" once every anchor of the JST day has passed. */
  date: "today" | "tomorrow";
}

/**
 * 2026-08-23 田平氏 GO (spec 2026-08-23-terminal-switching-ux-design §B):
 * 「次の更新」は時計ベース。registry の updateTimeLabel ("HH:MM" JST) と
 * 文字列比較し、now より後の最初のアンカーを返す。アンカー分そのもの
 * (12:03:00) は「始まった」扱い (producer の窓 start と同じ向き)。全て過ぎて
 * いれば翌日の先頭 (asia-open)。
 *
 * 観測 RED でセッションが無い日に、reviewed packet のセッション + 1 という
 * 時計を見ない算出が「次の更新: Europe Bridge 12:03」を 13:40 にも出し続けた
 * (8/23 実測) のを直すための純関数。
 */
export function resolveNextSession(now: Date): NextSession {
  const hhmm = jstHhMm(now);
  const upcoming = READER_SESSIONS.find(
    (session) => session.updateTimeLabel > hhmm,
  );
  if (upcoming) return { def: upcoming, date: "today" };
  return { def: READER_SESSIONS[0], date: "tomorrow" };
}

/** 今日 (JST) の未来アンカー数 — モバイルの「本日あと N 回更新」用。 */
export function countRemainingSessions(now: Date): number {
  const hhmm = jstHhMm(now);
  return READER_SESSIONS.filter((session) => session.updateTimeLabel > hhmm)
    .length;
}
