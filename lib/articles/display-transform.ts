import { calculateArticleBodyChecksum } from "@/lib/articles/article-inflow-validation.mjs";

/**
 * 表示層タイトル抑止 (P2-LVM-INFLOW-G2 D2)。
 *
 * mirror 本文は先頭行に記事タイトルをそのまま含む (canonical receipt 20/20 で
 * trim 後完全一致を実測)。保存層はバイト不変が契約なので、除去は MDX へ渡す
 * 直前の表示層でのみ行い、checksum の責務を分離する:
 * - source_body_checksum = 受領 body の checksum (SDE canonical route 検証の
 *   対象・本 gate で変えない)
 * - display_body_checksum = 実際に MDX へ渡したテキストの checksum
 * - display_transform_id = 適用した変換の識別子。無変換なら "none"
 *   (その場合 display == source)
 *
 * 二段階 activation (T1a→T2a→T1b): ACTIVE_ARTICLE_DISPLAY_TRANSFORM_ID が
 * "none" の間、変換コードは存在するが不活性。SDE 側 observer が 3 点検証
 * (source + expected display + transform id) へ改訂されてから有効化する。
 */

export const DROP_LEADING_EXACT_TITLE_V1 = "drop-leading-exact-title-v1";

/** T1b (2026-08-07) で有効化済み。T2a (observer 3 点検証) が merge 済みで
 * あることが停止線 — 12:20 配信前に両側が揃わない場合は merge を次サイクルへ */
export const ACTIVE_ARTICLE_DISPLAY_TRANSFORM_ID: string = DROP_LEADING_EXACT_TITLE_V1;

export interface ArticleDisplayResult {
  displayBody: string;
  displayBodyChecksum: string;
  /** 実際に適用された変換。対象行が無く無変換だった場合は "none" (fail-open) */
  displayTransformId: string;
}

/**
 * 本文の最初の非空行が両端 trim のみでタイトルと完全一致する場合に限り、
 * その 1 行を除去する。部分一致・曖昧一致・複数行は対象外 (不一致なら何もしない)。
 */
export function applyArticleDisplayTransform(
  body: string,
  title: string,
  transformId: string = ACTIVE_ARTICLE_DISPLAY_TRANSFORM_ID,
): ArticleDisplayResult {
  if (transformId === DROP_LEADING_EXACT_TITLE_V1) {
    const lines = body.split(/\r?\n/);
    const firstIndex = lines.findIndex((line) => line.trim() !== "");
    if (firstIndex >= 0 && lines[firstIndex].trim() === title.trim()) {
      const displayBody = lines
        .slice(0, firstIndex)
        .concat(lines.slice(firstIndex + 1))
        .join("\n");
      return {
        displayBody,
        displayBodyChecksum: calculateArticleBodyChecksum(displayBody),
        displayTransformId: DROP_LEADING_EXACT_TITLE_V1,
      };
    }
  }
  return {
    displayBody: body,
    displayBodyChecksum: calculateArticleBodyChecksum(body),
    displayTransformId: "none",
  };
}
