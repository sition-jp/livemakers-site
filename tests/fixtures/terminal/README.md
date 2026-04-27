# Terminal v2 Asset Contract — Fixtures

Spec: [`08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md`](../../../../../08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md)

## ファイル

| ファイル | 役割 | 対応エンドポイント |
|---|---|---|
| [`terminal_assets.sample.json`](terminal_assets.sample.json) | SDE builder が `07_DATA/content/intelligence/terminal_assets.json` に書き出す canonical 形式 | (内部 — builder/reader 境界) |
| [`dashboard.sample.json`](dashboard.sample.json) | 4 銘柄ダッシュボード API レスポンス | `GET /api/dashboard` |
| [`asset_summary_ada.sample.json`](asset_summary_ada.sample.json) | ADA 詳細ページ API レスポンス（縦切り基準） | `GET /api/assets/ada/summary?include=governance,defi,epoch,staking` |
| [`sipo_stances.sample.json`](sipo_stances.sample.json) | 田平氏が手書き編集する DRep 投票スタンスファイル | (builder 入力ファイル) |

## 利用ルール

- **Step 4 API 実装**: zod schema を `lib/terminal/asset-summary.ts` 等に定義。ルートは fixture を初期データとして読み、zod parse で validation する
- **contract test**: zod parse が fail したら test も fail させる（runtime degrade とは独立）
- **runtime degrade**: 本番では file absent → 空、parse error → field null と退行する。ただし fixture は常に schema 完全準拠
- **PSI**: fixture を実データで書き換える時は、まず zod parse が通ることを確認してから commit

## 留意点

- `_fixture_note` / `_dashboard_note` / `_chain_note` 等の `_` プレフィックスフィールドは zod schema で `.passthrough()` 扱い、もしくは strip する。runtime fail させない
- `dashboard.sample.json` の `governance.active_actions_count` は dashboard 専用の slim 形（full payload は asset summary 側）
- 数値はリアルだが日付ベースの値（2026-04-27 想定）。fixture を再生成する時は `terminal_assets.sample.json` を canonical として、他 3 ファイルを派生
