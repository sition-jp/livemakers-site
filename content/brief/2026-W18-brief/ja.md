# LiveMakers Weekly Brief — W18 / Apr 26 - May 2 2026

**発行日**: 2026-05-03 JST · **Epoch**: 628 (627→628 transition 4/29) · **Issue #4**

---

## エグゼクティブサマリー

W18 は、Cardano が **「閉じた島から主権ハブへ」** 外延を広げた週として記録される。前週 W17 が「採用される側から設計する側へ」の自立宣言だったとすれば、W18 はその設計を **自分の境界線の外側に届け始めた最初の週** である。三つの軸が同時に動いた。第一軸は **ユーザー接点の多チェーン化** ── 4/29 に Lace Mobile が公開され、4/30 に Lace 2.0 が Cardano + Bitcoin + Midnight を初日からマルチチェーン対応として発表された。Cardano エコシステムが「閉じた島」を脱した最初のフロントエンドである。第二軸は **L1+L2 アーキテクチャの自立完成** ── 5/1 に IOG が L2 フルスタック (Midgard + Hydra + optimistic rollup) を公式ロードマップとして発表し、Hydra v2 alpha では collectCom フェーズが撤廃され、Charms Beaming が BTC を eBTC として Cardano メインネットに着地させた。これは wrapped-bridge L2 の構造的代替案が実装層で具体化したことを意味する。第三軸は **エンタープライズ接続の起動** ── 4/30 の Filecoin × Cardano 公式対談 (Charles Hoskinson × Marta Belcher)、4/28 の USDM Michigan Money Transmitter License 認可、5/2 の Cardano Foundation × Grant Thornton による **世界初のオンチェーン財務監査** が同週に揃った。背景には W17 で確立した **IOG 2026 予算 $46.8M (前年比 -52%)** が効いている。前年比半分以下の規模で上記三軸を同時着火している事実こそが、田平氏の **Architecture Paradigm Shift ドクトリン** (Kelp DAO $293M ハック後の wrapped-bridge L2 終焉論) を実装で裏付けている。AI Agent Economy は Charles の Consensus 2026 main stage 予告 (5/14-16・Agents/Privacy/Blockchain) と Cardano 公式 x402 統合で「次の応用層」として可視化され、来週以降の主題に位置づけられた。マーケットは VIX 16.99 (-9.19% W-o-W) で地政学プレミアムの慢性化処理がさらに深まる一方、USDJPY が 159.333 → 157.033 (-1.44%) と急速な円高に振れ、FOMC (4/29-30) を通過した Powell が「事実上の最終 FOMC 会見」を実施した。**自立 (W17) → 外延 (W18)** の連続二週で、Cardano は外部資本依存から離陸し、自ら設計した標準を外部世界に届けるフェーズに入った。

---

## 1. Market Pulse

### Week-over-Week (4/25 close → 5/2 close)

| Asset | W-Start | W-End | W-o-W Δ | 備考 |
|---|---|---|---|---|
| BTC | $77,581 | $78,340 | **+0.98%** | $76-78K レンジで膠着・週末に再上昇 |
| ETH | $2,314.58 | $2,297.42 | **-0.74%** | 横ばい・対 BTC 弱含み |
| ADA | $0.2512 | $0.2489 | **-0.92%** | ガバナンス過密で価格は遅行 |
| NIGHT | $0.03745 | $0.03192 | **-14.77%** | 短期需給支配・dApp 進捗とは乖離 |
| WTI | $94.88 | $102.50 | **+8.03%** | 4/30 に $108 タッチ後反落 |
| Brent | $99.78 | $108.83 | **+9.07%** | 4/30 に $111 タッチ後反落 |
| Gold | $4,725.40 | $4,625.60 | -2.11% | リスクオン傾斜で安全資産売り |
| DXY | 98.51 | 98.211 | -0.30% | レンジ・FOMC 通過で一段安 |
| VIX | 18.71 | **16.99** | **-9.19%** | **ボラ慢性化処理が深化** |
| SPX | 7,165.08 | 7,230.12 | +0.91% | 7,200 上方定着 |
| US 10Y | 4.31% | 4.378% | +0.07pt | 上振れ |
| USD/JPY | 159.333 | **157.033** | **-1.44%** | **急速な円高・キャリー巻き戻し** |
| COIN | 199.77 | 191.25 | **-4.27%** | NY AG 提訴影響 (W17 -11%) を引き継ぎ |

### FOMC 4/29-30 通過 — Powell「事実上の最終 FOMC 会見」

W18 最大の単一マクロイベントは FOMC (4/29-30) であった。Powell は事実上の最終 FOMC 記者会見を行い、市場は **「Powell から Warsh へ」** のレジーム移行を織り込みに入った。Bessent 財務長官は「Powell の留任は異例で、Warsh は Fed の新しい一日を開く」とコメント。これに合わせて USDJPY は 159.333 → 157.033 (-1.44%) と急速な円高に振れた。VIX は週末 16.99 (-9.19% W-o-W) まで沈み、SPX は 7,230 で過去最高更新圏。**地政学・金融政策・暗号資産規制の三層リスクが「常駐コスト」として処理される段階** が W17 から継続深化した。

### 原油急騰と慢性化処理

WTI は 4/30 に $108.04 (+8.12%) まで急騰し、Brent は $111.60 まで到達。Hormuz プレミアムが再々燃したが、5/1-2 の安値では WTI $102.50 / Brent $108.83 まで落ち着いた。**ピーク時にも VIX は 18.81 までしか戻らず、終値ベースで再び 16.99 まで下落した事実** が、地政学ショックを織り込み済として処理する機関姿勢を裏付けている。

### COIN -4.27% — 単独要因の継続

COIN は W17 (NY AG 提訴) の影響を引き継ぎ -4.27%。BTC +0.98% との明確な乖離は、機関投資家が「暗号資産 ≠ 暗号資産関連株」として扱うようになったことを示す。BTC ETF 経由の直接エクスポージャーが COIN 株価への依存を解消した構造変化が、4 月後半から鮮明化している。

---

## 2. Ecosystem Watch — Lace 2.0 とフロントエンド多チェーン化

### Lace Mobile 公開 (4/29) と Lace 2.0 マルチチェーン解禁 (4/30)

W18 の Ecosystem 層で最大のニュースは、**Lace ウォレットの初日マルチチェーン対応** である。

- **4/29**: Lace Mobile が公開 — モバイル展開の解禁
- **4/30**: Lace 2.0 が **Cardano + Bitcoin + Midnight を初日からマルチチェーン対応** として発表

これは単なる UI 更新ではなく、**Cardano エコシステムが「閉じた島」から脱した最初のフロントエンド** である。SIPO ドクトリンの一つ「Lace Multichain Doctrine」(4/29 確立) が指摘するとおり、ここには三軸の転換が含まれる:

1. **UX 到達** — モバイル + マルチチェーンを単一ウォレットで完結
2. **エコシステム範囲拡張** — Cardano だけのウォレットから Bitcoin/Midnight も扱う「主権ハブ」へ
3. **戦略自立化** — IOG 中心の閉じた設計から、エコシステム自走型へ

ユーザー側から見れば、**Cardano + Bitcoin DeFi + プライバシー決済を一つの Lace で扱える** 状態が初めて成立した。これは W17 で IOG が 50% 削減した予算規模で、ユーザー接点層をマルチチェーン化することに成功した実装証拠である。

### Daedalus 8.0.0 + Mithril ブートストラップ (4/29)

Daedalus フルノードウォレットも 8.0.0 メジャーアップデートを受け、Mithril チェックポイントによる **高速ブートストラップ** を初期実装。フルノード起動時間の構造的短縮は、ステーキングウォレット運用の参入障壁を低下させる。

### 開発者ツール層の同期

- **1AM CLI Midnight 開発者ツール** (5/1) — Midnight 用 CLI ツールセットが OSS で公開
- **TapTools 4 周年** (5/1) — VC ファンディングなしで Cardano インフラ構築を継続したアナリティクス事業者の節目
- **Materios Network** (4/29) — Cardano DeFi インテント決済プリミティブの予告
- **pogun.io** (5/2) — Bitcoin DeFi を Cardano にもたらす提案・FluidTokens / BIFROST との接続候補

### Cardano TVL とエポック転換

- **Cardano TVL**: ~$148M (W17 $145M → +2.1% W-o-W)・ADA 価格 -0.92% の中の構造的増分
- **Stake 比率**: ~21.78B ADA・Stake active ratio 約 59%
- **Epoch 627 → 628 (4/29 transition)**: Node 10.7.1 メインネット対応・near-zero downtime upgrade で運用パターンが確立

エポック 628 は SIPO Tokyo が「**外延の宣言**」と位置づけたエポックである。

---

## 3. Governance Update

### IOG 2026 予算 — $46.8M / 前年比 -52% の実数公表 (4/28)

W17 で「9 件構成・前年比 50% 未満」と概要発表された 2026 トレジャリー提案は、4/28 に **総額 $46.8M (前年比 -52%)** という実数が公表された。

| 提案 | 規模 | 主目的 |
|---|---|---|
| Leios テストネット | 27.7M ADA | L1 スケーリング (6 月公開予定) |
| Plutus V5 / van Rossem HF | (含む全体予算) | 5/28 GA 提出予定 |
| Hua フェーズ準備 | (含む全体予算) | 2026 H2 ZK プリミティブ統合 |
| **CIP-159 microfee + multi-asset treasury** | (新規) | **収益層の構造拡張** |
| その他 5 件 | コア開発・教育・ガバナンス支援 |

特筆すべきは、4/27 に IOG が追加申請した **CIP-159 マイクロ手数料 + マルチアセット財務** 提案である。これは Cardano の「収益層」を構造的に拡張する設計で、ADA だけでなくマルチアセット (USDM 等) でも財務管理が可能になる。これにより Cardano Treasury の運用は **「ADA 単一通貨依存」から「マルチアセット財務」** へ移行する道筋が示された。

### Intersect Constitutional Committee 選挙 — 5/1 1200 UTC 投票締切

Intersect の憲法委員会 (CC) 選挙が 5/1 1200 UTC (21:00 JST) で締切となった。Pebble + Gerolamo を中心とする候補が DRep 投票で決定される。**Cardano ガバナンスが憲法層の人事まで DRep 投票で決める段階に入った** ことを示す節目である。

なお、当初 5/1 締切だったが、4/30 の正式案内で **5/8 まで一週間延長** された経緯がある。延長理由は投票プロセスの透明性確保のため。SIPO DRep #11 / 1,010 として最終投票を実装する。

### Pondora ゼロトレジャリー論争と Charles の擁護論

W18 中盤、Pondora プロジェクトが「自社トレジャリーゼロ」を宣言したことで、Cardano コミュニティ内で **「ゼロ財務でプロジェクトを続けることが健全か」** という論争が起こった。Charles はこれに対し、**「リーダー交代がなければ失敗する」** と公開コメント。同時に **「troll feed 禁止」** としてアンバサダーを擁護する発言もあり、Cardano コミュニティのガバナンス文化が **「成熟期の自浄プロセス」** に入っていることを示した。

### 米国 — Charles vs CLARITY Act の構造批判 (4/26)

Charles Hoskinson は 4/26 公開のインタビューで、CLARITY 法案を **「業界全体に不利益をもたらす」** と批判。1933 年証券法の修正不可能性、3 層プロセスの腐敗、Security by Default の致命性を構造的に指摘した。注目すべきは、**5/2 に Ripple CTO David Schwartz が Hoskinson の CLARITY 押し戻しに公開で同調** したこと。Ripple は元来 SEC との闘争史を持つが、Cardano と並ぶ形で「業界全体の利益」として CLARITY Act の構造問題を共有する事例は初である。

### 日本 — 規制継続フェーズ

W17 で公表された FSA 最終ガイドライン (4/23) を受けて、W18 は **規制実装の継続フェーズ** に入った。新規の制度動はないが、以下が静かに進行している:

- 暗号資産 ETF 申請の初期動向 (Rakuten Wallet XRP 変換サービス開始 = 4/30)
- 20% 分離課税の実装フレームに対する業界調整
- 日本航空がヒューマノイドロボットの空港運用試験を開始 — AI 物理層の制度的受容拡大

---

## 4. Midnight Notes — Architecture Paradigm Shift の体現

### Midnight Explorer v2.0.0 LIVE (4/28) — Near-Zero Downtime Upgrade

Midnight Explorer v2.0.0 が 4/28 にライブ稼働した。注目点は **near-zero downtime upgrade** で実装された事実である。これは Midnight ネットワークが「アップグレード時に止まる初期型ブロックチェーン」から **「運用中に進化するインフラ」** へ移行したことを示す。Cardano UTxO + Partner Chain アーキテクチャの **運用成熟度** が実装層で具現化した。

### USDM Michigan Money Transmitter License 認可 (4/28)

USDM (Cardano ネイティブ USD ステーブル) が Michigan 州で **Money Transmitter License (MTL)** 認可を取得した。これは USDM が **米国州レベルで規制実績を積んだ初の Cardano nativeステーブル** であり、W17 の VIA Labs USDM × Midnight 統合と組み合わせれば、**「Cardano nativeステーブル + Midnight ZKプライバシー + Michigan MTL」** の三点セットが揃った。機関ユース (給与・サプライチェーン決済・B2B 送金) で米国規制実績を持つプライバシー決済路が、Cardano エコシステム内で初めて実装段階に入った。

### Charles "Midnight fixes this" + Nightstream + MPC DVN (4/26)

Charles Hoskinson は 4/26 に「Midnight fixes this」と公開コメント。これは **Nightstream (Midnight × クロスチェーン送金) + MPC DVN (Multi-Party Computation Decentralized Validator Network)** の組み合わせを指す発言で、マルチチェーン × ラップ資産 DeFi の構造的課題を Midnight が解決する設計が示された。**EUTXO × ZK × MPC** の三層が、Kelp DAO ハック後の wrapped-bridge L2 終焉論への構造的回答として機能し始めた。

### NIGHT 69,000 ホルダー突破 (4/27)

NIGHT トークンのホルダー数が 69,000 を突破した。価格は -14.77% W-o-W だが、ホルダー数の構造的増加は **「価格は遅行・利用は先行」** の典型パターンを示す。W17 の判定 (NIGHT は短期需給支配のボラタイル指標) を W18 でも踏襲すべきである。

### 1AM CLI Midnight 開発者ツール公開 (5/1)

1AM が Midnight 用 CLI 開発者ツールを公開。これは **Midnight Node 1.0.0 RC (W17) → Explorer v2.0.0 LIVE (W18) → CLI 開発者ツール (W18)** という三層インフラの完成を意味し、開発者誘致の物理的障壁が一段下がった。

### Charles Consensus 2026 main stage — 5/14-16 予告 (5/1)

IOG 公式が Charles の Consensus 2026 (5/14-16・Toronto) main stage 登壇を予告。テーマは **「Agents · Privacy · Blockchain」** で、SITION の Trinity Doctrine (AI エージェント = 金融の主役 / ブロックチェーン = 信用層 / プライバシー = 不可欠) と完全整合する。**Midnight × Cardano UTxO × AI Agent Economy** が初めて Tier 1 暗号資産カンファレンスのメインステージに乗る。

### Charms Beaming — BTC が eBTC として Cardano メインネットに着地 (4/29)

4/29 に Charms Beaming プロジェクトが BTC を **eBTC** として Cardano メインネットに着地させた。これは wrapped-bridge を介さない「**Bitcoin DeFi ネイティブ着地**」の最初の本番事例である。Hydra v2 alpha (collectCom フェーズ撤廃) と組み合わせれば、**Cardano が「Bitcoin DeFi の信用層」** として機能する設計が見え始めている。

### Cardano Foundation × Grant Thornton 監査 (5/2) — 世界初のオンチェーン財務監査

Cardano Foundation が **Grant Thornton による財務監査結果** を公表。これは **Reeve 決算オンチェーン監査の世界初事例** とされ、機関投資家・規制当局からの透明性要求に対する構造的回答となる。

### IOG 形式検証マイルストーン (4/29) — Romain Soulat

IOG の高保証チーム (Romain Soulat 主導) が **「Cardano スマートコントラクトの自動形式検証」** を達成した。これは EVM 側で頻発するハック (W16 Kelp DAO $293M) に対する **Cardano UTxO + 形式検証の構造優位** を実装層で証明する。EUTXO × EVM 乖離ドクトリン (4/23 確立) の最強の実装証拠である。

---

## 5. Risk Digest

| 次元 | レベル | 注記 |
|---|---|---|
| Technical | **LOW** | Node 10.7.1 メインネット対応・Daedalus 8.0.0 + Mithril ブートストラップ・Lace 2.0 マルチチェーン稼働・Hydra v2 alpha (collectCom 撤廃)・Charms Beaming で BTC eBTC 着地・形式検証マイルストーン達成。実装層リスクは継続的に低下。 |
| Governance | **MEDIUM** | Intersect CC 選挙 5/1 締切 → 5/8 延長。IOG 2026 予算 $46.8M (-52% YoY)・CIP-159 microfee + multi-asset treasury 提案。Pondora ゼロ財務論争で自浄プロセス進行中。SIPO DRep #11 / 1,010 維持。 |
| Regulatory | **MEDIUM (継続)** | 米: Charles vs CLARITY 構造批判 → Schwartz (Ripple CTO) 同調で「業界全体不利益」論が拡大。FOMC 4/29-30 通過・Powell 事実上最終会見。日: FSA 最終ガイドライン (W17) 後の規制実装フェーズ・Rakuten Wallet XRP 変換開始。 |
| Market | **MEDIUM (↘ 改善)** | VIX 16.99 (-9.19% W-o-W) で慢性化処理深化。USDJPY 157.033 (-1.44%) 急速円高・キャリー巻き戻し局面。原油 WTI/Brent 一時急騰も終値で落ち着き。BTC +0.98%・SPX 7,230 過去最高更新圏。COIN -4.27% は単独要因継続。 |
| Architecture | **LOW (構造優位顕在化)** | Lace 2.0 マルチチェーン (Cardano + BTC + Midnight) で「閉じた島」から脱した最初のフロントエンド。IOG L2 フルスタック (Midgard + Hydra + optimistic rollup) で wrapped-bridge L2 の構造的代替案が公式ロードマップ化。Filecoin × Cardano 公式対談で UTxO の外延が拡張。形式検証マイルストーンで EVM 側ハックへの構造優位が実装層で証明。 |

**Overall**: **MEDIUM (↘ 改善傾向)**

---

## 6. Next Week Preview

来週 (W19 / May 3 - May 9) の注目点を 5 つ挙げる。

1. **Intersect CC 選挙 5/8 投票締切** — 延長期間の最終週。SIPO DRep #11 として最終投票判断を実装し、voteContext (CIP-100 バイリンガル) を公開する。Cardano ガバナンスが憲法層人事まで DRep 投票で決める節目イベント。
2. **van Rossem HF ガバナンスアクション 5/28 GA 提出に向けた事前公示** — 5/3 の週中に公示文の骨格が公開予定。Plutus V5 投入準備の最終局面。
3. **Consensus 2026 (5/14-16・Toronto) Charles main stage 直前準備** — 「Agents · Privacy · Blockchain」テーマで Trinity Doctrine が Tier 1 カンファレンスのメインステージに乗る。Midnight × Cardano UTxO × AI Agent Economy の対外訴求の決定的瞬間。
4. **Cardano 公式 x402 統合の本格化** — W17 末に発表された AI エージェント決済標準 (x402) の Cardano 統合が、Stripe Link Wallet for Agents (W18 末) と並走で動く。**AI Agent Economy が応用層に降りる週** となる可能性。
5. **5 月機関配分窓 (Q2 リバランス) と BTC ETF フロー継続性** — 5 月初週の機関リバランスで BTC ETF 月次フローが構造的純流入を維持できるか。COIN -11% (W17) + -4.27% (W18) の累積調整が直接エクスポージャーに置き換わるかが鍵。

**W17 (採用される側 → 設計する側) → W18 (閉じた島 → 主権ハブ) → W19 (応用層に降りる)** ── 三週連続で Cardano の構造転換が実装層で具現化している。W19 は Charles の Consensus 2026 main stage 直前週として、対外訴求の最終調整期となる。

---

**発行**: LiveMakers (SITION Group)
**SIPO**: DRep **#11** · SPO ×3 · Midnight Ambassador
**データソース**: Koios · DefiLlama · CoinGecko · Dune Analytics · Twitterapi.io · GitHub · SEC EDGAR · Gazette Japan · Intersect MBO · IOG Essential Cardano

*本レポートは投資助言ではありません。機関投資家向け調査目的のみ。*
*Not investment advice. For institutional research purposes only.*
