# 「読み解きのみ」セッション (digest-only session) — 設計 (2026-08-23)

Status: `APPROVED — IMPLEMENTATION_GO` (2026-08-23 田平氏「この内容で進めて」)

## 0. 起点

Intelligence Terminal「切替中」解消 (PR #107) の後、田平氏: 「『数値スナップショットは無いが読み解きはある』窓をセッションとして見せるかは producer 側の判断事項 — 別途 GO」→ 表示方針の選択肢 3 つから **「読み解きのみの SESSION カード」** を裁定。

実例: 2026-08-23 12:03 Europe Bridge は市場観測 (home observer preflight) が RED (108 errors) でセッションレコード無し、一方 読み解き digest (`session_digests/2026-08-23_europe-bridge_1203.json`) は 12:34 に GREEN で書かれていた → 読者には「直前の Asia Open 終了」しか見えず、読み解きが死蔵された。

## 1. 硬い制約 (設計の出発点)

- feed 契約 (`livemakers_export/export_validator.py` `_validate_sessions_bundle`) と site の採用ガード (`lib/home/build-home-props.ts` `reviewedSourceMatchesSidecar`) は **`liveStatus === "live"` のレコードが `home.focusSession` (= 最後に GREEN だった市場アンカー) と slug / focusInstruments で一致すること**を要求する。RED 窓の読み解きを live として流すと feed 全体が RED (fail-closed) になる
- site zod (`SessionMetaSchema` は `strictObject`) は未知キーで **sessions bundle 全体**を落とす → 受け口 (site) を先に deploy しないと producer が出した瞬間に sessions rail が消える

## 2. 契約

セッションレコードに optional `observationStatus: "green" | "absent"` を追加 (省略 = `green`)。

- `liveStatus` は従来どおり窓 (`_SESSION_WINDOWS`) で live / closed。digest-only でも窓内なら live
- `observationStatus === "absent"` のレコードは **live ↔ `home.focusSession` の照合対象から外す** (producer validator / site sidecar match の両方)
- `absent` は `editorial` 必須 (読み解きが無ければ digest-only は成立しない) — zod / validator の双方で superRefine
- 「live は同時に最大 1 件」は不変 (同じ (date, slug) に GREEN 観測と digest-only が両立することは構造上ない — composer が GREEN 不在の slug にだけ digest-only を組む)
- `SESSION_RECORD_KEYS` (producer strict key set) に `observationStatus` を追加。site の `live-market-feed.ts` は `SessionMetaSchema` を verbatim 利用なので site 側は 1 箇所

## 3. producer (`session_composer.compose_session_records`)

GREEN 観測から組んだ後、`editorials` に (target_date, slug) があり GREEN レコードが無い slug について `render_digest_only_session_record` を組む:

| フィールド | 値 |
|---|---|
| `sessionId` / `date` / `sessionSlug` / `currentUrl` | 通常どおり |
| `liveStatus` | `_in_window(slug, date, now)` で live / closed (crystallize は closed) |
| `articleStatus` | `pending` |
| `observationStatus` | `"absent"` |
| `asOfJst` | editorial `writtenAtJst` (秒精度) |
| `focusInstruments` | registry 既定 (`_FOCUS_INSTRUMENTS_BY_SLUG`) |
| `titleJa` | `{reader_name} — {M}月{D}日 {anchor HH:MM} JST（読み解きのみ）` (anchor = `EDITORIAL_ANCHOR_BY_SLUG`) |
| `bullets` | editorial `items[].headline` 先頭 3 件。items が空なら `lead` の第 1 文 |
| `packetId` | `sess_{date}_{anchorHHMM}_{digest8}` (material = sessionId / focusInstruments / titleJa / bullets / editorial) |
| `editorial` | そのまま |

順序は `SESSION_SLUGS_ORDER`、`MAX_SESSION_RECORDS` (4) は不変。前日 global-close の持ち越し (05:02 まで) は digest-only も対象 (editorial があるので条件は自然に満たす)。

## 4. crystallize (`session_consolidator.crystallize_records`)

GREEN レコードに加え、digest-only も `closed` で記事化する。本文 (`render_session_markdown`) は snapshot_rows を空にし、冒頭に「この回は市場観測が取得できず、読み解きのみです。」を 1 行置く。meta に `observationStatus: "absent"` を残す (site ページは published でも注記を出す)。

## 5. site

- `SessionMetaSchema`: optional `observationStatus` + `absent` は editorial 必須
- `build-home-props.ts` `reviewedSourceMatchesSidecar`: `observationStatus !== "absent"` の live だけ照合。digest-only live の時は `sessionProvenance` を **page 来歴の集計 (`visibleWindowProvenance`) から外す** (市場スナップショットが無いのに `reviewed_live` を page に主張しない)。カードは描く (LeadingColumn の `live && sessionProvenance` 条件は維持)
- `SessionNowCard`: `observationStatus === "absent"` → バッジ `SESSION · {HH:MM} {JST 更新|JST 終了} · 読み解きのみ` / 鮮度行の接頭を「読み解き」/ 来歴行の代わりに「数値スナップショットなし（市場観測が未取得）」1 行 / `data-session-observation="absent"`
- `CompositeHero` (mobile): 時刻の後ろに ` · 読み解きのみ`
- `SessionPendingView`: absent は「数値スナップショット」節を描かず注記 1 行 (published でも同じ)
- copy: `sessionNow.digestOnlyLabel` / `sessionNow.digestFreshnessPrefix` / `sessionNow.noSnapshotNote` / `hero.digestOnlyLabel` / `sessions.noSnapshotNote` (ja/en)
- `recentClosed` (PR #107) は digest-only の closed も自然に対象 (終了カードに「読み解きのみ」が付く)

## 6. 順序

1. site PR (受け口・producer 未対応なら無風) → merge GO → deploy
2. sub-repo PR (composer / validator / cli 配線 / consolidator / pytest) → merge GO → 本番ツリー ff → runner re-pin
3. 次の RED 窓 (digest あり) で本番実測

## 7. 非対象

PF07 閾値・RED 率の低減 / digest が無い RED 窓 (= #107 の「直前セッション終了」表示のまま) / 焦点チャート (直前 GREEN の reviewed packet のまま)。
