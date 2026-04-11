# LiveMakers Weekly Brief — W15 / Apr 5-11 2026

**発行日**: 2026-04-11 JST · **Epoch**: 624 · **Issue #1**

---

## エグゼクティブサマリー

エポック 624 で Cardano DeFi Liquidity Budget の Withdrawal 1 (800,000 ADA) が ratified された。数字だけ見れば小規模だが、実体はケイマン財団・9 名 Interim Committee のマルチシグ・Amaru スマートコントラクトによる、50,000,000 ADA ($10M 超) の DeFi 流動性展開を運営するための制度インフラ費。旧 constitution 下で 67% を超える賛成を得ていた枠組みが、新 constitution 下での治理プロセスを経て実装段階に入った。同時期に Intersect MBO が 39 件の 2026 財務提案 (NCL 350M ADA) を DRep 投票に送り出し、Cardano Foundation が Project Catalyst の Managing Entity 候補として 63% 支持ラインを超えた。Cardano ガバナンスは構造改革の実装フェーズに入っている。

---

## 1. Market Pulse

**ADA**: $0.2503
（24h -0.3% · 時価総額 $9,250,000,000）

### L1 Peer Comparison (30D)

| Asset | Price | Market Cap | 30D |
|---|---|---|---|
| BTC | $72,825.0000 | $1,440,000,000,000 | +4.2% |
| ETH | $2,239.8000 | $270,000,000,000 | +9.4% |
| SOL | $84.2900 | $41,000,000,000 | -1.9% |
| ADA | $0.2503 | $9,250,000,000 | -4.0% |
| AVAX | $9.2800 | $3,800,000,000 | -3.1% |

---

## 2. Ecosystem Watch

**Cardano TVL**: $136,600,000

### Sector Breakdown
- **Dexes**: $72,800,000 (53.3%)
- **Lending**: $34,100,000 (25.0%)
- **CDP**: $14,800,000 (10.8%)
- **Stablecoin**: $8,300,000 (6.1%)
- **Other**: $6,600,000 (4.8%)

### Top Movers (24h TVL)
**Gainers:**
- Dano Finance: -0.4% ($19,200,000)
- Surf Lending: +2.7% ($2,300,000)
- Minswap DEX: +0.2% ($33,600,000)

**Losers:**
- FluidTokens: -1.3% ($5,100,000)
- SundaeSwap V3: -0.9% ($10,000,000)
- Liqwid: -0.5% ($26,700,000)

---

## 3. Governance Update

- **Active Proposals**: 3
- **Treasury**: ₳1,617,406,020
- **SIPO Vote Status** (#13): 3/3 投票済

### SIPO スタンス (進行中提案)
- **Cardano DeFi Liquidity Budget - Withdrawal 1 (Ratified E624)** — SIPO: **Yes** (実験的 DAO から公共ブロックチェーンへの制度設計コスト。800K ADA で 50M ADA 運営の法的・技術的インフラ (ケイマン財団・9名 Interim Committee multi-sig・Amaru contract) を整備。旧 constitution 67% 承認を新 constitution 下で実装化。)- **Approve Cardano Foundation as New Managing Entity of Project Catalyst (InfoAction)** — SIPO: **Yes** (Catalyst の運営主体移管。CF 63.21% の賛成ラインを超え、ファンディング構造の安定化に寄与。新 constitution 下で info action が実質的な指名メカニズムとして機能する初の事例。)- **HLabs Pebble + Gerolamo 2026 Budget** — SIPO: **Yes** (Haskell 実装 (Pebble) と Rust 実装 (Gerolamo) の継続開発予算。クライアント多様性は Cardano の長期耐障害性の基盤。)
---

## 4. Midnight Notes

- **Block Height**: 320000
- **Enterprise Pilots**: 4
- **DUST Status**: PRE-TGE

### Ambassador Insight
今週の Midnight エコシステムは、エンタープライズ採用と技術的ポジショニングの両面で加速した。Monument Bank の £250M–£335M 預金トークン化 PoC が進行中で、規制下の UK 銀行が Ethereum や Solana ではなく Midnight を選んだ事実は重い。9 社の初期バリデーター (Google Cloud・MoneyGram・Worldpay・Bullish・Vodafone Pairpoint 等) がすでに稼働し、Zoniqx との RWA パートナーシップ (DyCIST/ERC-7518 準拠) も発表された。Cardano 側では Minswap が $NIGHT-$USDCx Triple Farm を立ち上げ、1AM Wallet が v5.0.1 で Cardano ネイティブ統合とワンクリック DUST 生成を実装した (4/10 公開)。Bitget Launchpool では 4/9–4/16 に NIGHT 1,200 万トークンが配布される。

今週最大の話題はブリッジ論争だった。Cardano インフルエンサー @ItsDave_ADA が「Midnight ブリッジは Cardano から一方通行で、ADA/NIGHT を吸い取るだけで還流しない」と批判し、Hoskinson が公開謝罪を要求する事態となった。Hoskinson の主張は明確で、「一方通行は "フェーズ" であって "ポリシー" ではない」「トークノミクス文書には双方向ブリッジが明記されている」「Cardano が成長するか死ぬかの問題だ」。双方向ブリッジは 2026 年後半の Hua フェーズで実装予定で、Cardano 自身が ZK プリミティブを取り込む際にブリッジも深化する設計となっている。コミュニティには短期的ノイズに見えるが、制度設計の視点では「段階的実装を明文化したロードマップがある」こと自体が Tier 4 読者にとっての安心材料である。

SIPO Ambassador としての所感: Midnight は Cardano 本体が開拓できていないエンタープライズ市場を呼び込む装置であり、暗号業界をリードする存在になる。銀行・機関・行政が Ethereum/Solana ではなく Midnight を選ぶ動きは複数のミーティングで実感しており、SDE が捉えた Monument Bank 事例はその氷山の一角である。Cardano は Midnight が呼び込む流動性を受け止める基盤 (DeFi Liquidity Budget・39 件の 2026 Treasury 提案・Intersect のガバナンス実装) を着々と整備しており、両者が描く未来は確実に前進している。さらに重要なのは、AI エージェントが Cardano と Midnight の組み合わせを利用することで次の AI エージェント経済の信頼基盤となる可能性である。エンタープライズ・機関・行政から「選ばれる」フェーズは、すでに始まっている。

---

## 5. Risk Digest

| 次元 | レベル | 注記 |
|---|---|---|
| Technical | LOW | van Rossem HF (Protocol Version 11) 最終段階。Node 10.7.1 プレリリース数日以内。Plutus パフォーマンス向上と新 built-ins 有効化。ブロック生産はノミナル動作継続。 |
| Governance | MEDIUM | 39 件の 2026 財務提案 (NCL 350M ADA・優先インフラ 70M ADA) が DRep 投票に投入。Constitutional Committee 2026 選挙も同時進行 (候補応募 4/17 締切)。高密度の投票サイクルで DRep 参加率とコミュニケーション品質が試される。 |
| Regulatory | MEDIUM | 米国: CLARITY Act の 4月後半上院 Banking Committee ヒアリング確定 (Lummis・Hagerty 確認)。5 月マークアップ通過が次の関門、通過しなければ中間選挙前成立は事実上絶望的。日本: 金融庁が暗号資産を資金決済法から金商法へ移行する改正案を 2026 年通常国会に提出予定。インサイダー規制新設・申告分離 20% 税制案・銀行子会社参入解禁。 |
| Market | MEDIUM | Iran Hormuz 危機継続で VIX 26.84・WTI $116 超え・Gold $4,710。マクロ risk-off モードでクリプトは BTC $69k を維持。ADA は 30D −4% と L1 内で相対的に弱いが、Midnight モメンタムと Liquidity Budget の ratify で下支えあり。ADA 週次出来高は +79%。 |

**Overall**: **MEDIUM**

---

## 6. Next Week Preview

来週の注目点は 5 つ。第一に van Rossem HF (Protocol Version 11) — Node 10.7.1 のメインネット展開タイミングが確定する見込みで、Plutus パフォーマンスと新 built-ins の本番投入が Cardano DeFi の次の成長フェーズを解放する。第二に Intersect が DRep 投票に投入した 39 件の 2026 財務提案 (NCL 350M ADA) の初期投票動向。高密度のサイクルで DRep 参加率とコミュニケーション品質が試される。第三に Constitutional Committee 2026 選挙の候補応募締切 4/17 — 新 constitution 下での初の本格的 CC 選挙として、誰が立候補するかで Cardano の治理方向性が決まる。第四に Monument Bank Midnight PoC (£250M–£335M) の進捗と、銀行規制当局の反応。第五に米国 CLARITY Act の上院 Banking Committee ヒアリング日程確定と DeFi 条項の最終交渉。日本側では金商法改正案の正式提出が近づいており、税制 20% 分離課税の成否も注視すべき論点である。

---

**発行**: LiveMakers (SITION Group)
**SIPO**: DRep #13 · SPO ×3 · Midnight Ambassador
**データソース**: Koios · DefiLlama · CoinGecko · GitHub

*本レポートは投資助言ではありません。機関投資家向け調査目的のみ。*
*Not investment advice. For institutional research purposes only.*