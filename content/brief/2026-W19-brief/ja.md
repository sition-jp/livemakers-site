# LiveMakers Weekly Brief — W19 / May 3 - May 9 2026

**発行日**: 2026-05-09 JST · **Epoch**: 629 (628→629 transition 5/4) · **Issue #5**

---

## エグゼクティブサマリー

W19 は、**Trinity（AI エージェント × プライバシー × ブロックチェーン）が Cardano 上で実装に降りた最初の週**として記録される。前週 W18 が「閉じた島から主権ハブへ」外延拡張を実装したフェーズだったとすれば、W19 はその外延の上に **「AI エージェントが規制ガード下で動く主権金融層」** が組み上がった週である。三つの軸が同じ 7 日間で同時着地した。第一軸は **メインステージのキーノート枠** ── 5/6 に Charles Hoskinson が Consensus 2026 Miami のメインステージに登壇（IOG 公式 @IOGroup の 5/3 予告投稿によれば「**Agents · Privacy · Blockchain**」を 5/6 12:00 PM ET 枠で）。SITION の Trinity Doctrine（AI エージェント = 金融の主役 / ブロックチェーン = 信用層 / プライバシー = 不可欠）と Cardano 公式キーノートの主題が、Tier 1 暗号資産カンファレンスの最重要枠で独立に同期した節目である。第二軸は **インフラ層の同時着火** ── 5/6 に Pyth Pro が Cardano 上で本番稼働し（Pentad Critical Integration 第 1 弾・Indigo Protocol が初ユーザー）、5/4 には Cardano Foundation × Scorechain がコンプライアンス基盤フル統合、5/4 には Tweag の ₳39.8M Peras インフラ提案がオンチェーン投票キューに載り、Lace 2.0 Android 版が継続展開された。価格データ／コンプライアンス／コア研究／モバイル UX の 4 層が一週で実装層に揃った。第三軸は **規制下デジタル金融の「機関側からの応答」** ── 既存の **Midnight × Monument Bank パートナーシップ（2026-03-25 公式発表・英国 PRA/FCA 規制下デジタルバンク）** が、5/3 の blockworks DAS で創業者 Mintoo Bhandari により Tier 1 機関投資家フォーラム向けに詳細解説され、Charles の Consensus 主題予告と並走するタイミングで再可視化された。Charles のテクノロジー側「外に届ける」ベクトルに対して、規制下機関が「内に取り入れる」ベクトルとして対応する構造が、W19 に同期して見えるようになった。市場の織り込みは即座だった。**ADA W-o-W +10.7%・ALGO +22.0%・SOL +10.3%** vs **BTC +2.5%・ETH +0.7%** ── L1 alt が分散インフラへ resync する明確な signal が点灯し、**WTI -7.6%（Iran 緊張後退）**・**DXY -0.4%**・**SPX +2.3% 過去最高更新圏**でリスクオン傾斜が静かに広がった。マクロ側は **既存の規制クリアと新規進展の合算追い風** ── Fed が銀行向け crypto-asset guidance を撤回したのは 2025-04-24 の措置で約 1 年前から実装済みだが、W19 で **CLARITY Act がステーブルコイン yield「使用ベース許容・idle 禁止」妥協で markup 直前**まで進み、**Tether が Q1 2026 attestation を「過去最強の四半期スタート」として公開**したことで、既存の Fed クリアが再評価される構図となった。**外延拡張（W18）→ Trinity 始動（W19）** の連続二週で、Cardano は「設計した標準を外部に届ける」段階から「外部世界が設計を取り入れに来る」段階に移行した。

---

## 1. Market Pulse

### Week-over-Week (5/2 close → 5/9 close)

| Asset | W-Start | W-End | W-o-W Δ | 備考 |
|---|---|---|---|---|
| BTC | $78,340 | $80,328 | **+2.54%** | $80K 回復・週末リスクオン |
| ETH | $2,297.42 | $2,312.90 | +0.67% | 横ばい・対 BTC 弱含み継続 |
| ADA | $0.2489 | $0.2756 | **+10.73%** | **L1 alt アウトパフォーム首位級** |
| NIGHT | $0.03192 | $0.03265 | **+2.29%** | W18 -14.77% から底打ち反転 |
| SOL | $83.82 | $92.45 | **+10.30%** | ADA と並走で復調 |
| XRP | $1.39 | $1.42 | +2.16% | レンジ上抜け継続 |
| ALGO | $0.1090 | $0.1331 | **+22.05%** | **Charles post-quantum 言及で評価** |
| DOT | $1.30 | $1.38 | +6.15% | DOT 復調 |
| ICP | $3.06 | $3.51 | **+14.71%** | AI agent 文脈で再評価 |
| WTI | $102.50 | $94.68 | **-7.63%** | Iran 緊張後退・$95 割れ |
| Brent | $108.83 | $100.49 | **-7.66%** | Brent も連動 |
| Gold | $4,625.60 | $4,723.70 | +2.12% | 安全資産も上昇（リスクオン中の珍しい同方向） |
| DXY | 98.211 | 97.843 | -0.37% | ドル小幅安 |
| VIX | 16.99 | 17.19 | +1.18% | ほぼ横ばい・低位安定 |
| SPX | 7,230.12 | 7,398.93 | +2.33% | **過去最高更新圏定着** |
| US 10Y | 4.378% | 4.364% | -0.014pt | レンジ |
| USD/JPY | 157.033 | 156.621 | -0.26% | 円高傾向継続 |
| COIN | 191.25 | 201.16 | **+5.18%** | W17/W18 累積調整から反発 |

### L1 alt 同時アウトパフォーム — 構造再評価の兆候

W19 最大のマーケット signal は、**ADA +10.73% / ALGO +22.05% / SOL +10.30% / DOT +6.15% / ICP +14.71%** が BTC +2.54% を大きく上回ったことである。L1 alt の同時上昇は単なるベータ拡大ではない。**ICP は AI agent narrative・ALGO は Charles の post-quantum 言及・ADA は Pyth Pro/Trinity・SOL は Western Union USDPT 5 月稼働確定** ── それぞれ独立した触媒を持つ動きが同期した。**機関配分が「BTC + ETH 二極」から「分散インフラ全体」へ resync する初期局面**の可能性が高い。

### Iran 緊張後退 → 原油急落

WTI / Brent はともに約 -7.6% W-o-W。Project Freedom 護衛による短期 spike（W18 末 $108）から、Trump「Hormuz は OPEN TO ALL」発言（5/6）と外交トラックへの移行で **$95 割れまで下落**した。地政学プレミアムの再々々織り込みが進み、VIX 17.19（+1.18%）は **「地政学ショック→慢性化処理→織り込み完了」**のサイクル深化を示す。

### 規制環境の追い風 — 既存 Fed ガイダンス撤回 + CLARITY Act 妥協

W19 のマクロ追い風は、新規発表よりも **既存の規制クリアが効き始めたタイミングの一致**として読むべきである。Federal Reserve は **2025-04-24 に銀行向け暗号資産・ドルトークンガイダンスの撤回**を既に実施済みで（[Fed press release](https://www.federalreserve.gov/newsevents/pressreleases/bcreg20250424a.htm)）、銀行の暗号資産関連業務における事前承認要件は約 1 年前から実質撤廃されている。W19 で新たに効いたのは **CLARITY Act ステーブルコイン yield「使用ベース許容・idle 禁止」妥協（5/5-5/6）+ Tether Q1 2026 attestation 公開** ── 既存の Fed ガイダンス撤回が CLARITY Act markup 接近で再注目され、COIN +5.18% W-o-W の反発を後押しした構図である。

---

## 2. Ecosystem Watch — Pyth Pro が Cardano DeFi に「価格レイヤー」を着地

### Pyth Pro Live on Cardano (5/6) — Pentad Critical Integration 第 1 弾

W19 の Ecosystem 層で最大のニュースは、**Pyth Pro が Cardano 本番稼働を開始した**ことである。これは 2025 年 12 月に Cardano Foundation × Pentad（IOG / EMURGO / CF / Intersect / Pyth）が予告した **Pentad Critical Integrations** の最初の本番実装である。

- **発表元**: Pyth Network 公式（5/6）
- **第 1 ユーザー**: **Indigo Protocol**（Cardano 最大の合成資産プロトコル・5/8 に "Pyth Pro is now powering the oracle layer behind Indigo's synthetic asset infrastructure" を公式表明）
- **機能**: ミリ秒単位の価格更新・暗号学的検証・オンデマンド取得・機関参加者直接ソース
- **対象**: perpetuals / synthetics / lending / RWAs / equities

**「Cardano DeFi がついに待ち望んでいた価格レイヤーを手に入れた」**（Pyth Network 公式声明）。これは Cardano DeFi の制約だった信頼できるオラクル層問題に直接答える着地で、**Lending（Liqwid / Lenfi）・Synthetic（Indigo）・Perpetual（Hyperliquid 系）・RWA** 系プロトコルが一斉に新しい設計余地を得た。

### Cardano × Scorechain — コンプライアンス基盤フル統合 (5/4)

5/4 に Cardano が **Scorechain（欧州大手 AML/コンプライアンス分析プラットフォーム）の全フレームワーク**に統合された。これにより:

- ウォレット層レベルでの取引リスク評価
- 規制当局向け調査ワークフロー
- 機関カストディ・取引所向けコンプラ分析

が Cardano ネイティブで実行可能になる。**W18 の Grant Thornton 監査（世界初オンチェーン財務監査）と組み合わせれば、機関が Cardano に乗るための「監査 + コンプラ」の二層が同月に揃った**。

### Midgard Labs フル L2 スタック発表 (5/4)

W18 末に IOG 公式ロードマップ入りした L2 フルスタックの実装担当として、**Midgard Labs（Sharan Konerira リード）** が L2-agnostic インフラを発表。Cardano UTxO 上で **Hydra（state channel）+ optimistic rollup + Midgard（DA layer）** の三層を統合する設計で、ETH 側の wrapped-bridge L2 とは構造的に異なる。**Architecture Paradigm Shift ドクトリン（4/22 確立）** の実装担当が固まった瞬間である。

### Tweag ₳39.8M Peras 提案がオンチェーン投票キューに (5/4)

W18 で IOG 2026 予算 $46.8M（前年比 -52%）が公表された流れで、**Tweag の ₳39.8M Peras インフラ提案**がオンチェーン投票キューに載った。Peras は **Cardano の決定性 finality を強化する研究プロジェクト**で、Leios / Hua フェーズと並ぶコアインフラ研究枠である。SIPO DRep として今後の投票判断対象。

### Lace 2.0 Android 版継続展開・1AM CLI Midnight 開発者ツール

W18 で出した Lace 2.0 マルチチェーンの Android 版が継続的にロールアウトされ、Midnight 用 1AM CLI 開発者ツールも安定運用フェーズに入った。**フロントエンド（Lace 2.0）・開発者層（1AM CLI）・コア研究（Peras / Leios / Hua）・価格データ（Pyth Pro）・コンプラ（Scorechain）** の 5 層が同時に動いている。

### Cardano TVL とエポック転換

- **Epoch 628 → 629 transition 5/4** ── 「Trinity 着地」を示すエポックとして記録
- **Cardano TVL**: ~$155M（W18 $148M → +4.7% W-o-W）── ADA 価格 +10.7% を上回らないが、構造的増分継続
- **Stake 比率**: 約 60% で安定、SIPO DRep #11 / 1,010 維持

---

## 3. Governance Update

### Charles Consensus 2026 メインステージ公演 (5/6) — Trinity が公式キーノートに

5/6 に Charles Hoskinson が **Consensus 2026 Miami のメインステージ**に登壇した。**IOG 公式アカウント (@IOGroup) が 5/3 に予告した発表**によれば、登壇テーマは「**Agents · Privacy · Blockchain**」、登壇枠は **Wed May 6 12:00 PM ET**（出典: IOG 公式 X 5/3 プロモーション投稿）。Consensus 2026 Miami 自体は 5/5-5/7 開催（[Consensus FAQ](https://consensus.coindesk.com/faq/)）。

> ⚠️ **出典注記**: 登壇日時とテーマは IOG 公式 X 投稿（5/3）が一次ソース。Consensus 公式アジェンダページでの該当セッション記載は本稿執筆時点で当方では確認できなかった ── 二次ソース確認は来週の Consensus 後レポートで補完する。

事前公開された Charles 自身のツイート ── **"my keynote for Consensus Miami shall be 'We Don't Need Roads'"** （5/3）── は、Back to the Future Part II の最終シーンを引用したもので、**「既存のスケーリング論争（roads = レイヤー間競争）を超越した実装層がすでに揃っている」**という宣言として読める。

メインステージで提示された Trinity（AI agent + privacy + blockchain）は、**SITION の Trinity Doctrine（4/24 確立）と Cardano 公式戦略発信が完全に同期したこと**を示している。SITION 側で先行整理していた仮説（[project_sition_ai_agent_economy.md](memory/project_sition_ai_agent_economy.md)）と Cardano 公式キーノートの主題が一致したという意味で、Cardano 単独の戦略提唱に留まらず、業界全体に対して「次の応用層は AI エージェント主権金融である」というアジェンダ設定が動き出した節目である。

### Charles "Scaling 放棄は虚偽の物語" 直接反論 (5/5)

5/5 に Charles は X 上で **「I am getting insanely tired of hearing a false narrative that we abandoned scaling in favor of governance」** と公開反論した。Hugo Philion (Flare) との応酬を経て、Cardano が **L1 スケーリング（Leios）+ L2 フルスタック（Midgard）+ ガバナンス（Voltaire）+ プライバシー（Midnight）** を **同時並行で進めている**事実を再確認する流れとなった。

### IOG 2026 予算（W18 → W19 投票フェーズ）

W18 で公表された **IOG 2026 予算 $46.8M（前年比 -52%）** がオンチェーン投票キューに載り、W19 はその審議フェーズに入った。9 提案のうち **CIP-159 microfee + multi-asset treasury** は SIPO DRep として注目すべき構造拡張提案。Tweag ₳39.8M Peras も同じキューに加わり、SIPO DRep #11 として複数提案を一括精読する局面となる。

### Intersect Constitutional Committee 選挙 5/8 締切

W18 から延長された **Intersect CC 選挙が 5/8（金）に締切**を迎えた。Pebble + Gerolamo を中心に、SIPO DRep として最終投票を実装した（投票結果は来週確定）。**Cardano ガバナンスが憲法層人事まで DRep 投票で決める** 事実は、Voltaire フェーズの完成度を示す重要な節目である。

### CLARITY Act ステーブルコイン yield 妥協 → markup 直前 (5/5-5/6)

米議会の CLARITY Act 審議は、5/5-5/6 に **ステーブルコイン yield 部分で「使用ベース許容・idle 禁止」決着**に至り、markup（条文確定段階）直前まで進んだ。Tillis-Alsobrooks 共同声明、Coinbase Brian Armstrong の支持表明、Lummis 議員の加速要求 ── 業界・議会・規制当局の三者が同じ妥協点に収束した。**業界にとって 2017 年以降最大の規制クリア**となる可能性が出てきた。

### Fed crypto guidance — 2025-04-24 撤回が CLARITY Act 接近で再注目

Federal Reserve の **銀行向け crypto-asset / ドルトークンガイダンス撤回は 2025-04-24 実施**（[Fed press release](https://www.federalreserve.gov/newsevents/pressreleases/bcreg20250424a.htm)）── 銀行の暗号資産関連業務における事前承認要件は約 1 年前から実質撤廃済みである。W19 はこの既存の規制クリアが、CLARITY Act markup 接近で **「規制不確実性下で動いていた業界」が次フェーズに踏み出す前提条件**として再注目された週となった。

### 日本 — 規制実装フェーズ継続

W18 に続き、新規の制度動はない。Rakuten Wallet XRP 変換サービス開始（W18）後、**業界調整は分離課税 20% フレームの実装段階**に入った。

---

## 4. Midnight Notes — 規制下機関が「内に取り入れる」フェーズ

### Midnight 🤝 Monument Bank — Mintoo Bhandari が blockworks DAS で統合詳細を解説 (5/3)

W19 の Midnight 層で最大のニュースは、**Mintoo Bhandari（Monument Bank 創業者）** が 5/3 の blockworks DAS（Digital Asset Summit）NY で **Midnight × Monument Bank 統合**の詳細を公開解説したことである。

- **公式パートナー発表**: 2026-03-25（[Monument 公式リリース](https://mondovisione.com/media-and-resources/news/monument-becomes-the-first-bank-to-securely-tokenise-retail-deposits-in-partners-2026325/) ── "first bank to securely tokenise retail deposits in partnership with Midnight"）
- **DAS 露出 (5/3)**: Bhandari が Monument の Midnight 統合の意義を Tier 1 機関投資家向けカンファレンスで詳細解説
- **キーフィギュア**: Mintoo Bhandari（Monument Bank 創業者・元 Apollo Global Management Senior Partner）
- **CoinDesk 取材**: 5/3 に CoinDesk が Bhandari と F_ZK_Now（Midnight 関係者）に取材

公式パートナーシップ自体は 3/25 発表だが、**W19 の意義は「Tier 1 機関投資家フォーラムでの詳細露出 + Consensus 2026 直前タイミング」が同期したこと**にある。Monument は英国で PRA / FCA の完全認可を受けたデジタルバンクで、リテール預金トークン化に Midnight の ZK プライバシー層を統合する設計を、**Cardano エコシステムにおいて最初に実装した規制下機関**である。

W18 の **USDM Michigan MTL（米国州レベル規制）** + 既往の **Monument Bank パートナー（英国国家レベル規制下機関）** という二層が、Charles の Consensus メインステージ予告と並走する形で **「Midnight ZK プライバシー × Cardano UTxO の機関導入路」**を W19 に再可視化した。

### Midnight Booth at Consensus Miami (5/5-5/7)

Midnight Network は Consensus 2026 Miami（5/5-5/7）に **公式ブース**を構え、Day 1 / Day 2 連続で live ストリームを発信した。Ben Beckmann（CEO）の登壇含め、**Trinity の「プライバシー軸」が Tier 1 カンファレンスで物理的に存在感を示した最初の機会**である。

### CF CEO Gregaard「AI エージェントはガバナンスより速く動いている」(5/6)

Cardano Foundation CEO Frederik Gregaard は 5/6 に **「AI agents are moving faster than governance」** と公開発言。これは批判ではなく、**「だから先回りで規制対応を実装する必要がある」**という Cardano 側の戦略宣言である。Charles メインステージ + Monument Bank パートナー + Scorechain 統合 + Pyth Pro 着地 ── すべての方向が「規制速度に AI エージェント実装を合わせ込む」一点に収束している。

### 10 億 NIGHT 償還達成 (W18 末 → W19 確定)

Midnight Foundation の **NIGHT 10 億トークン Glacier Drop 償還達成**が W18 末から W19 にかけて確定。NIGHT W-o-W +2.29% は底打ち反転の signal であり、**「価格は遅行・利用は先行」**の典型パターンが継続している。

### Charles Trinity 公演の構造的含意

メインステージでの Trinity 公演（5/6）は、**SITION の AI Agent Economy doctrine（4/24 確立）** ── **「AI エージェント = 金融の主役 / ブロックチェーン = 信用層 / プライバシー = 不可欠」** ── と **Cardano 公式戦略発信が同じ主題に収束した**ことを意味する。SITION 側で先行整理していた戦略仮説（[project_sition_ai_agent_economy.md](memory/project_sition_ai_agent_economy.md), [project_cardano_architecture_paradigm_shift.md](memory/project_cardano_architecture_paradigm_shift.md)）と、Cardano 公式キーノートの主題が独立に同期した事実は、当該仮説が Cardano エコシステム単独の見方ではなく業界全体の next phase アジェンダとして読まれ始めていることを示唆する。

---

## 5. Risk Digest

| 次元 | レベル | 注記 |
|---|---|---|
| Technical | **LOW** | Pyth Pro Cardano メインネット稼働・Indigo 初ユーザー実装・Midgard L2 フルスタック実装担当固定・Tweag Peras オンチェーン投票キュー・Lace 2.0 Android 継続展開・Scorechain コンプラ統合。実装層リスクは継続低下。 |
| Governance | **MEDIUM** | Intersect CC 選挙 5/8 締切（SIPO DRep 投票実装済）。IOG 2026 予算 $46.8M（CIP-159 microfee + multi-asset treasury 含む）・Tweag ₳39.8M Peras がオンチェーン投票キューに追加。SIPO DRep #11 / 1,010 維持。Charles Trinity キーノートで Cardano 戦略の方向性が一意に収束。 |
| Regulatory | **MEDIUM (↘ 改善)** | 米: 既存の Fed crypto guidance 撤回（2025-04-24・約 1 年前から実装済）+ 新規 CLARITY Act ステーブルコイン yield 妥協で markup 直前（5/5-6）+ Tether Q1 attestation 過去最強。合算で「2017 年以降最大の規制クリア窓」局面。日: 規制実装フェーズ継続。 |
| Market | **LOW (リスクオン)** | ADA +10.73% / ALGO +22.05% / SOL +10.30% / ICP +14.71% / DOT +6.15% で **L1 alt 同時アウトパフォーム**。BTC +2.54% / ETH +0.67% を大きく上回る分散インフラ resync signal。WTI -7.63% で Iran 緊張後退・地政学プレミアム慢性化処理深化。VIX 17.19（横ばい）・SPX 7,398 過去最高更新圏。COIN +5.18% で W17-W18 累積調整から反発。 |
| Architecture | **LOW (Trinity 始動で構造優位顕在化)** | Charles メインステージで Trinity（AI agent + privacy + blockchain）キーノート・Pyth Pro 価格レイヤー着地・Monument Bank 既存パートナーシップの DAS 再露出・Scorechain コンプラ統合。**「外延拡張（W18）→ Trinity 始動（W19）」** の連続二週で UTxO + Partner Chain の構造優位が「機関側からの応答」として可視化。 |

**Overall**: **MEDIUM (↘ 改善傾向継続・Trinity 始動でアーキテクチャ層は LOW)**

---

## 6. Next Week Preview

来週（W20 / May 10 - May 16）の注目点を 5 つ挙げる。

1. **Consensus 2026 Miami 終了直後の波及測定** — Charles メインステージ Trinity 公演の業界反応・Midnight ブース来訪 KPI・Midgard Labs / Pyth Pro 関連の二次パートナー発表が W20 序盤に集中する可能性。
2. **van Rossem ハードフォーク 5/28 GA 提出に向けた最終公示** — DB-Sync は van Rossem ready、Plutus V5 投入準備の最終局面。SIPO ノード側の 11.0.x アップグレードと同期して進む。
3. **Intersect CC 選挙結果確定（W20 序盤）** — 5/8 締切後の集計結果公表。Pebble + Gerolamo 中心の構成が確定し、Cardano 憲法層のガバナンス実装が本格稼働へ。
4. **IOG 2026 予算 + Tweag Peras + CIP-159 一括投票フェーズ** — SIPO DRep #11 として複数提案の評価マトリクスを再構築する局面。Architecture Paradigm Shift ドクトリンと整合する判断軸を一貫適用する。
5. **CLARITY Act markup 通過 / Fed Warsh 移行織り込み** — 規制クリアの最終段階。COIN / BTC ETF / 機関配分窓 5 月後半の流れに直接連動。

**W17（採用される側 → 設計する側）→ W18（閉じた島 → 主権ハブ）→ W19（Trinity 始動）→ W20（メインステージ後の波及）** ── 四週連続で Cardano の構造転換が「設計 → 実装 → 公式提唱 → 業界波及」のフェーズを順次踏んでいる。W20 は **Trinity Doctrine が業界全体のアジェンダになるかどうかの初期測定週**となる。

---

**発行**: LiveMakers (SITION Group)
**SIPO**: DRep **#11** · SPO ×3 · Midnight Ambassador
**データソース**: Koios · DefiLlama · CoinGecko · Dune Analytics · Twitterapi.io · GitHub · SEC EDGAR · Gazette Japan · Intersect MBO · IOG Essential Cardano · Pyth Network 公式 · Midnight Foundation 公式 · Consensus 2026 Miami

*本レポートは投資助言ではありません。機関投資家向け調査目的のみ。*
*Not investment advice. For institutional research purposes only.*
