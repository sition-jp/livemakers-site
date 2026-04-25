# LiveMakers Weekly Brief — W17 / Apr 19-25 2026

**Published**: 2026-04-25 JST · **Epoch**: 627 (625→626 transition Apr 19, 626→627 transition Apr 24) · **Issue #3**

---

## Executive Summary

W17 will be recorded as the week Cardano **moved from being "the L1 that gets adopted" to being "the L1 that designs what gets adopted next."** Coming off W16, when Cardano became "an L1 ready to be adopted," this week saw a **three-layer convergence** that lifted the chain into its self-sufficient phase. **Layer one — autonomy**: between Apr 22 and Apr 25, IOG published 9 Treasury proposals for 2026 with a **total under 50% of last year's budget**, anchoring the Strategy 2030 roadmap (Leios testnet in June, Plutus V5, van Rossem HF governance action May 28) on its own balance sheet. **Layer two — adoption bridge**: VIA Labs announced a **USDM × Midnight integration on Apr 24**, alongside Midnames mainnet, an Eclipse 4-week bounty, the first Zealy partner sprint, **Midnight Node 1.0.0 RC** (Apr 25), and Explorer v2.0.0 (Apr 23) — five ignition points firing in the same week. **Layer three — institutional tailwind**: BTC ETFs flipped to a **positive April monthly inflow** (also positive YTD), Senator Moreno publicly committed to passing the CLARITY Act "by end of May" (moving prediction-market odds +8pt), and Japan's FSA published **final guidelines on Apr 23** formally classifying crypto assets as financial instruments. Markets carried a renewed Hormuz premium (WTI +14.88%, Brent +10.40%) yet VIX fell to 18.71 (-8.20% W-o-W) — institutions processed geopolitical risk as a **standing cost** rather than an event. Underneath this week sits a triad of doctrines crystallized on the SITION side: **Trinity Doctrine** (AI agents = primary financial actors, blockchain = trust layer, privacy = non-negotiable), **Architecture Paradigm Shift** (the end of wrapped-bridge L2s after the Kelp DAO $293M hack and the structural superiority of Partner Chain strategy), and **EUTXO × EVM Divergence** (DeFi Kernel / Midnight ZKP / Partner Chain making the gap visible in shipped code). **With autonomy, adoption-bridge, and institutional-tailwind layers all converging in the same seven days, W17 is the first week in which Cardano detached from external-capital dependence and stood up as the chain that designs the next standard.**

---

## 1. Market Pulse

### Week-over-Week (Apr 19 → Apr 25 morning)

| Asset | W-Start | W-End | W-o-W Δ | Note |
|---|---|---|---|---|
| BTC | $75,881.78 | $77,581 | **+2.24%** | $75-78K range, ETF April flip-positive |
| ETH | $2,357.51 | $2,314.58 | **-1.82%** | Decoupling continues |
| ADA | $0.250 | $0.251 | **+0.40%** | Governance momentum holding |
| NIGHT | $0.03832 | $0.03745 | **-2.27%** | dApp shipping accelerates, price lags |
| WTI | $82.59 | $94.88 | **+14.88%** | Hormuz premium re-ignited |
| Brent | $90.38 | $99.78 | **+10.40%** | 2 commercial vessels seized (Apr 24) |
| Gold | $4,879.6 | $4,725.4 | -3.16% | Safe-haven premium peeled off |
| DXY | 98.226 | 98.51 | +0.29% | Range |
| VIX | 20.38 | **18.71** | **-8.20%** | **Vol falls as crisis becomes chronic** |
| US 10Y | 4.25% | 4.31% | +0.06pt | Risk-on confirmation |
| USD/JPY | 158.587 | 159.333 | +0.47% | Carry rebuilt |
| SPX | 7,126.06 | 7,165.08 | +0.55% | 7,100 holds as floor |
| DJI | 49,447.44 | 49,230.71 | -0.44% | Sector rotation continues |

### Geopolitics-as-Standing-Cost

W17 was the week the Hormuz premium became **structural** rather than episodic. Iran re-closure speculation drove WTI +6.76% on Apr 20; Apr 22 was the ceasefire-deadline day; on Apr 24 Iran seized two commercial vessels, with Brent holding above $100. And yet VIX collapsed to 18.71 (-8.20% W-o-W) into the weekend, while SPX held near all-time highs at 7,165. **This is the moment a geopolitical shock converted from a "single event" into a "permanent line item"** in the institutional risk model. With BTC/ETH camped near the upper bound of Hayes's "No Trade Zone" thesis (the AI-deflation × asset-inflation coexistence), institutions are processing geopolitics as the **base case**, not a vol source. COIN's -7.41% on Apr 22 (NY AG suit) and another -4.03% Apr 24 were idiosyncratic; the BTC ETF flip to monthly-positive signaled the regime change in institutional flows.

### BTC ETF Flows — What "Monthly Flip-Positive" Means

- **April monthly**: absorbed early-month outflows and **flipped positive**; YTD also confirmed positive (Apr 24)
- **Structure**: institutional allocation rules (e.g., 1-3% target weights for BTC) convert geopolitical drawdowns into rebalance buy windows
- **Next milestone**: the May allocation window (Q2 rebalance) will test the persistence of monthly-positive flows

The W16 ETF inflow that survived the Hormuz closure was upgraded in W17 into a **structural net inflow** — a phase declaration that institutional crypto allocation has moved from raising the ceiling to raising the floor.

---

## 2. Ecosystem Watch — The Self-Sufficient Phase Blueprint

### IOG 2026 Treasury Proposals — Strategic Compression to "Under 50%" (Apr 22-25)

IOG ran an AMA for the 2026 budget on Apr 22 (3,004 attendees), released the budget skeleton on Apr 23, and finalized 9 Treasury proposals by Apr 25. The defining feature: **total budget is under 50% of last year's**.

- **Leios testnet**: official launch in June, ~27.7M ADA, the core of Strategy 2030
- **Plutus V5 / van Rossem HF**: governance action submission targeted for May 28 (Intersect Weekly #108)
- **Hua phase prep**: foundational research toward H2 2026 ZK primitive integration
- **9-proposal slate**: split across core dev / smart-contract upgrades / DX / operations / education / governance support

This is **not austerity but a declaration of autonomy**. Against the backdrop of weakening centripetal pull from Cardano Foundation and EMURGO (treated as long-term positive in the SITION doctrine), IOG demonstrated it can walk forward at its own scale. From the Tier 4 lens, this marks the **end of the Catalyst era (the expansion-investment phase) and the entry into operations phase**.

### Next-Generation dApp Surface

- **VESPR v4** (Apr 25): Cardano wallet announces upcoming **Bitcoin support** — first user-facing manifestation of Partner Chain strategy
- **Pulse DEX** (Apr 25): **AMM + Orderbook hybrid architecture** announced just before public testnet — EVM-style DEX features rebuilt on EUTxO
- **Chainlink × AWS Marketplace** (Apr 25): cross-chain oracle reaches enterprise procurement rails — indirect tailwind for Cardano-side RWA projects
- **jpg.store closure** (Apr 24): the largest Cardano NFT marketplace ends 5 years of operations. This is **not contraction but a transition signal** — NFT primitives are being re-built on top of DeFi Kernel + Midnight ZKP for the next phase

### Cardano TVL and Epoch Transitions

- **Cardano TVL**: ~$145M (W16 $142M → +2.1% W-o-W; structural activity during a flat ADA tape)
- **Stake share**: 21.81B → 21.80B ADA (-0.05%); active stake ratio ~59%
- **Epoch 626 (Apr 19) and 627 (Apr 24)**: block production nominal; minor perf improvements rolling through Node 10.7.x

Epoch 627 was framed by SIPO Tokyo as the "**autonomy declaration epoch**" — synchronizing with the IOG 50%-cut announcement.

---

## 3. Governance Update

### Intersect 2026 Budget DRep Vote Goes Live (Apr 22)

Six days after the W16 budget process kickoff (Apr 16), **DRep voting opened officially on Apr 22**. The 3,004-attendee AMA the same day shows Cardano governance shifting from "deliberation phase" to "ratification phase."

| Indicator | Value | Note |
|---|---|---|
| AMA attendance (Apr 22) | **3,004** | Largest to date — objective indicator of community engagement |
| Proposal count | **9** | Under 50% of last year — selective composition |
| Leios scale | **27.7M ADA** | Strategy 2030 core |
| van Rossem HF GA | **May 28 target** | Plutus V5 prerequisite |
| SIPO DRep rank | **#11 / 1,010** | Stable just outside Top-10 |

### Singapore Summit Vote — Still Live Through May 10

Per the doctrine established Apr 22, this brief treats the Singapore Summit proposal as **"vote in progress."** Several outlets have written "rejected" based on interim tallies, but the formal status is not finalized until ratification at the epoch boundary. As SIPO DRep #11, the final voting decision will be implemented by May 10.

### US — Senator Moreno's "End of May" Commitment Moves Prediction Markets +8pt (Apr 22-23)

- **CLARITY Act**: Sen. Moreno (R-OH) publicly committed to "passing it by end of May"
- **Prediction markets**: end-May passage probability jumped **+8pt** immediately after the comment
- **Treasury Secretary Bessent**: reaffirmed support for the "ABA compromise" path, building on his Apr 14 WSJ op-ed
- **Warsh Fed hearing** (Apr 21): Fed independence reconfirmed; **DeFi position holdings** (Compound / Optimism) disclosed — the optics of the Fed leadership having direct DeFi exposure feed into institutional consensus

If CLARITY passes by **end of May**, the US regulatory package — alongside the SEC DeFi UI Safe Harbor (proposed Apr 14) — **completes within Q2**.

### Japan — FSA Final Guidelines Lock the Path to "Financial Instrument" Classification (Apr 23)

- **Apr 23**: FSA released **final guidelines** on the FIEA-migration of crypto assets
- Crypto = formally classified as financial instrument; insider-trading rules apply; **20% separated taxation** framework presented
- **Apr 21**: meeting between FSA Minister Katayama and the BIS General Manager (digital finance discussion); public-comment results published for the National Strategic Special Zone Cabinet Order amendment — structural, ongoing institutional motion

The Cabinet decision in W16 (Apr 10) and the W17 final guidelines together complete **the institutional rails** — providing the prerequisites for ADA-ETF product applications in Japan.

---

## 4. Midnight Notes — The Adoption Bridge Goes Live

### USDM × Midnight Integration (Apr 24) — The Privacy-Dollar Settlement Origin

The VIA Labs announcement on Apr 24 provides the **first privacy-enabled stablecoin settlement path** in the Cardano ecosystem.

- **Structure**: USDM (Cardano-native USD stablecoin) usable on Midnight = dollar-denominated settlement gains a **Zero-Knowledge privacy layer**
- **Significance**: institutional use cases (payroll, supply-chain settlement, B2B remittance) can now operate with **amount, counterparty, and pattern hidden from third parties** for the first time on the Cardano stack
- **Trinity Doctrine wiring**: the 4/24 doctrine's "privacy = non-negotiable" pillar is the first to be satisfied by a shipped product

### Midnight Same-Day Triple-Launch (Apr 24)

- **Midnames**: mainnet implementation — human-readable Midnight address naming service
- **Eclipse bounty**: 4-week sprint kicks off — a continuity mechanism for developer recruitment
- **Zealy partner sprint**: first run — funnel for community-layer participation

### Midnight Node 1.0.0 RC (Apr 25) and Explorer v2.0.0 (Apr 23)

Node 1.0.0 RC is a critical maturity milestone for Midnight mainnet. Explorer v2.0.0 ships a refreshed UI for visualizing ZK transactions. **Usable / observable / programmable** — all three properties were lifted into place this week.

### Reading the -2.27% NIGHT Drop

- W-Start $0.03832 → W-End $0.03745
- Price is the **lagging indicator**. dApp acceleration, USDM integration, and Node 1.0.0 RC are mid-term tailwinds, but the spot tape is dominated by short-term supply absorption (post-Bitget Launchpool inventory)
- **Verdict**: NIGHT remains a "volatile milestone gauge for project execution." It should be observed separately from the institutional-adoption thesis on L1 Cardano.

### Architecture Paradigm Shift, Made Visible This Week

The doctrine crystallized on Apr 22 (the post-Kelp-DAO-$293M-hack thesis on the end of wrapped-bridge L2 architecture) gained **visible structural evidence** during W17. The EVM-side hack stands as a counter-example to Cardano UTxO + Partner Chain, and the three-pillar architecture (Midnight ZK + Minotaur + Hydra) entered its implementation phase as a candidate for "the next standard."

---

## 5. Risk Digest

| Dimension | Level | Note |
|---|---|---|
| Technical | **LOW** | Node 10.7.1 stable; Leios testnet locked for June; Plutus V5 / van Rossem HF GA submission targeted May 28; Midnight Node 1.0.0 RC released. Implementation-layer risk on USDM × Midnight is contained. |
| Governance | **MEDIUM** | Intersect 2026 budget DRep vote opened Apr 22; ratification in May; treasury withdrawal in June. Singapore Summit vote live through May 10. SIPO DRep #11 / 1,010 holds. First-full-cycle procedural-friction risk persists. |
| Regulatory | **MEDIUM (↘ improving)** | US: CLARITY Act end-May commitment by Sen. Moreno; prediction markets +8pt; Warsh Fed DeFi position disclosure. JP: FSA final guidelines (Apr 23) complete the financial-instrument rails; 20% separated taxation framework presented. **US-Japan regulatory package on track to complete within Q2**. |
| Market | **MEDIUM** | Hormuz premium re-ignited (WTI +14.88%, Brent +10.40%) but VIX 18.71 (-8.20% W-o-W) signals chronic-vol absorption. BTC +2.24%; ETF April flip-positive. FOMC (estimated Apr 29-30) is next week's largest single event. COIN cumulative -11% (NY AG suit) is idiosyncratic. |
| Architecture | **LOW** | EVM L2 / wrapped-bridge tail-risk continues from the Kelp DAO $293M hack (W16). Cardano UTxO + Partner Chain structural advantage (Midnight ZK / Hydra / Minotaur, three pillars) is becoming visible at the implementation layer. The Apr 23 EUTXO × EVM Divergence Doctrine is the highest-priority editorial theme. |

**Overall**: **MEDIUM (↘ improving)**

---

## 6. Next Week Preview

Five things to watch in W18 (Apr 26 – May 2):

1. **FOMC (estimated Apr 29-30)** — the intersection of the Hormuz premium, AI-deflation, and rate-cut expectations. Any update to the SEP / dot plot would feed directly into crypto allocation models.
2. **CLARITY Act Senate Banking Committee markup progress** — one month remains until Moreno's end-of-May commitment becomes a hard deadline. The final form of the ABA compromise should crystallize next week.
3. **Mid-cycle tally for Intersect 2026 budget DRep vote** — opened Apr 22, ratification in May. SIPO #11 will continue executing votes and publishing CIP-100 bilingual voteContexts.
4. **Pre-publication of the van Rossem HF governance action (May 28 target)** — the public-comment skeleton is expected the first week of May. Final preparation for Plutus V5 deployment.
5. **Midnight 1.0.0 RC → mainnet promotion timeline** — 1-2 weeks is standard validation for an RC. Whether the USDM × Midnight integration goes live in production is the highest-resolution observation point.

In Japan, **early activity on crypto-asset ETF applications** following the Apr 23 final guidelines runs in parallel. **Whether the "designer" stance Cardano took in W17 — building on the W16 "ready-to-be-adopted" window — converts into concrete institutional implementation and inflows in W18** is the central question for the coming week.

---

**Issuer**: LiveMakers (SITION Group)
**SIPO**: DRep **#11** · SPO ×3 · Midnight Ambassador
**Sources**: Koios · DefiLlama · CoinGecko · Dune Analytics · Twitterapi.io · GitHub · SEC EDGAR · Gazette Japan · Intersect MBO · IOG Essential Cardano

*This report is not investment advice. For institutional research purposes only.*
