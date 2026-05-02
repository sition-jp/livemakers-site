# LiveMakers Weekly Brief — W18 / Apr 26 - May 2 2026

**Published**: 2026-05-03 JST · **Epoch**: 628 (627→628 transition Apr 29) · **Issue #4**

---

## Executive Summary

W18 will be recorded as the week Cardano **extended its perimeter — from "closed island" to "sovereign hub."** If W17 was the self-sufficiency declaration ("from getting adopted to designing what gets adopted"), W18 was the first week Cardano started **delivering that design beyond its own boundary**. Three axes moved in sync. **Axis 1 — User-facing multichain**: Lace Mobile launched Apr 29, and Lace 2.0 shipped Apr 30 with **day-one multichain support across Cardano, Bitcoin, and Midnight**. This is the first frontend that breaks Cardano out of its closed-island posture. **Axis 2 — L1+L2 architecture self-sufficiency completed**: On May 1 IOG announced its L2 full stack (Midgard + Hydra + optimistic rollup) as official roadmap, Hydra v2 alpha removed the collectCom phase, and Charms Beaming landed BTC as eBTC on Cardano mainnet. The structural alternative to wrapped-bridge L2 has materialized at the implementation layer. **Axis 3 — Enterprise interconnect ignited**: The Apr 30 Filecoin × Cardano official conversation (Charles Hoskinson × Marta Belcher), the Apr 28 USDM Michigan Money Transmitter License approval, and the May 2 Cardano Foundation × Grant Thornton **world-first onchain financial statement audit** all aligned in the same week. The backdrop is W17's **IOG 2026 budget of $46.8M (-52% YoY)** — firing all three axes simultaneously with less than half last year's budget is itself the implementation evidence for the **Architecture Paradigm Shift doctrine** (post-Kelp DAO $293M hack, the structural end of wrapped-bridge L2 dependency). The AI Agent Economy was made visible as "the next application layer" via Charles's Consensus 2026 main-stage preview (May 14-16, "Agents · Privacy · Blockchain") and Cardano's official x402 integration, positioning W19+ as the moment that layer descends. Markets saw VIX fall to 16.99 (-9.19% W-o-W), deepening chronic-volatility absorption, while USDJPY snapped from 159.333 to 157.033 (-1.44%) — sharp yen strength as Powell delivered an effectively final FOMC press conference (Apr 29-30). **Self-sufficient (W17) → Outward extension (W18)**: across two consecutive weeks, Cardano detached from external-capital dependence and entered the phase of delivering its own designed standard to the outside world.

---

## 1. Market Pulse

### Week-over-Week (Apr 25 close → May 2 close)

| Asset | W-Start | W-End | W-o-W Δ | Note |
|---|---|---|---|---|
| BTC | $77,581 | $78,340 | **+0.98%** | $76-78K range, week-end re-acceleration |
| ETH | $2,314.58 | $2,297.42 | **-0.74%** | Flat; weak vs. BTC |
| ADA | $0.2512 | $0.2489 | **-0.92%** | Governance-heavy week; price lags |
| NIGHT | $0.03745 | $0.03192 | **-14.77%** | Short-term supply/demand dominated; decoupled from dApp progress |
| WTI | $94.88 | $102.50 | **+8.03%** | $108 touch on Apr 30 then reverted |
| Brent | $99.78 | $108.83 | **+9.07%** | $111 touch on Apr 30 then reverted |
| Gold | $4,725.40 | $4,625.60 | -2.11% | Risk-on tilt drains safe-haven premium |
| DXY | 98.51 | 98.211 | -0.30% | Range; further softness post-FOMC |
| VIX | 18.71 | **16.99** | **-9.19%** | **Vol absorption deepens** |
| SPX | 7,165.08 | 7,230.12 | +0.91% | 7,200 confirmed as floor |
| US 10Y | 4.31% | 4.378% | +0.07pt | Higher |
| USD/JPY | 159.333 | **157.033** | **-1.44%** | **Sharp yen strength; carry unwind** |
| COIN | 199.77 | 191.25 | **-4.27%** | NY AG suit (W17 -11%) overhang continues |

### FOMC Apr 29-30 Cleared — Powell's "De Facto Final Press Conference"

W18's largest single macro event was the FOMC (Apr 29-30). Powell delivered what markets read as an effectively final FOMC press conference, and pricing began to shift toward a **"Powell → Warsh"** regime transition. Treasury Secretary Bessent commented that "Powell's stay-on is unusual; Warsh marks a new day at the Fed." USDJPY snapped from 159.333 to 157.033 (-1.44%), VIX printed 16.99 (-9.19% W-o-W) at week-end, and SPX cleared 7,230 in record-territory. **Geopolitics, monetary policy, and crypto-regulation as a three-layer "standing cost"** — the institutional posture that took shape in W17 deepened structurally in W18.

### Crude Spike and Chronic Absorption

WTI spiked to $108.04 (+8.12%) on Apr 30, with Brent reaching $111.60 — Hormuz premium re-igniting once more. By the May 1-2 lows, WTI settled to $102.50 / Brent $108.83. **At the peak, VIX retraced only to 18.81 and re-collapsed to 16.99 by close** — the institutional discount of geopolitical shock as a baseline cost (rather than a discrete event) is now operationally visible.

### COIN -4.27% — Single-Issuer Drag Continues

COIN carried W17's NY AG suit overhang into another -4.27% W-o-W. The clean divergence from BTC (+0.98%) shows institutions now treat **"crypto" and "crypto-related equities"** as separate exposures. BTC ETF direct exposure has dissolved the pre-2024 dependence on COIN as a proxy — the structural shift visible since late April is now confirmed.

---

## 2. Ecosystem Watch — Lace 2.0 and Frontend Multichain

### Lace Mobile Launch (Apr 29) and Lace 2.0 Multichain Release (Apr 30)

The defining ecosystem-layer story of W18 is the **day-one multichain release of the Lace wallet**.

- **Apr 29**: Lace Mobile public release — mobile distribution unblocked
- **Apr 30**: Lace 2.0 ships **day-one multichain support across Cardano + Bitcoin + Midnight**

This is not a UI refresh. It is the **first frontend that breaks Cardano out of its closed-island posture**. As the SIPO Lace Multichain Doctrine (established Apr 29) frames it, three transitions are bundled:

1. **UX completion** — mobile + multichain in a single wallet
2. **Ecosystem scope expansion** — from "Cardano-only" to a wallet that natively handles Bitcoin and Midnight
3. **Strategic self-sufficiency** — from IOG-centric closed design to ecosystem-driven autonomy

From the user side, **Cardano + Bitcoin DeFi + privacy-grade settlement is now reachable from a single Lace** for the first time. This is implementation evidence that, on a 50%-cut budget, the ecosystem successfully multi-chained its frontend touchpoint.

### Daedalus 8.0.0 + Mithril Bootstrap (Apr 29)

Daedalus full-node wallet shipped its 8.0.0 major update with **Mithril checkpoint bootstrap** as initial implementation. The structural shortening of full-node startup time lowers the operational entry barrier for staking-wallet operators.

### Developer Tooling Layer Synchronization

- **1AM CLI for Midnight developers** (May 1) — open-source CLI tooling
- **TapTools 4-year anniversary** (May 1) — analytics provider that built Cardano infrastructure without VC funding reaches a milestone
- **Materios Network** (Apr 29) — Cardano DeFi intent-based settlement primitive announced
- **pogun.io** (May 2) — Bitcoin DeFi-to-Cardano proposal; candidate for FluidTokens/BIFROST integration

### Cardano TVL and Epoch Transition

- **Cardano TVL**: ~$148M (W17 $145M → +2.1% W-o-W); structural growth despite -0.92% ADA price
- **Stake**: ~21.78B ADA, ~59% active ratio
- **Epoch 627 → 628 (Apr 29 transition)**: Node 10.7.1 mainnet-ready, near-zero downtime upgrade pattern established

SIPO Tokyo characterizes Epoch 628 as the **"outward-extension epoch."**

---

## 3. Governance Update

### IOG 2026 Budget — $46.8M / -52% YoY Disclosed (Apr 28)

The 2026 treasury proposal — flagged in W17 as "9 items, under 50% of last year" — was disclosed in concrete terms on Apr 28: **$46.8M total, -52% YoY**.

| Proposal | Scale | Purpose |
|---|---|---|
| Leios testnet | 27.7M ADA | L1 scaling (June launch) |
| Plutus V5 / van Rossem HF | (in total) | May 28 GA submission |
| Hua phase prep | (in total) | 2026 H2 ZK primitive integration |
| **CIP-159 microfee + multi-asset treasury** | (new) | **Revenue-layer structural extension** |
| 5 other items | Core dev / education / governance support |

The notable addition is the **CIP-159 microfee + multi-asset treasury** proposal IOG submitted Apr 27. This is structural extension of Cardano's "revenue layer" — treasury management becomes possible across multiple assets (USDM and beyond), not just ADA. The path from **"single-currency ADA dependence" to "multi-asset treasury"** is now visible.

### Intersect Constitutional Committee Election — May 1 1200 UTC Deadline

The Intersect Constitutional Committee (CC) election deadline closed May 1 1200 UTC (21:00 JST). Pebble + Gerolamo were leading candidates put to DRep vote. **Cardano governance now decides constitutional-layer personnel by DRep vote** — a structural milestone.

The original May 1 deadline was officially **extended to May 8** (one-week extension) on Apr 30 to ensure procedural transparency. SIPO DRep #11 / 1,010 will execute final vote during the extension window.

### Pondora Zero-Treasury Controversy and Charles's Defense Posture

Mid-week, the Pondora project declared "zero own-treasury" — sparking debate on whether running a project with zero treasury is structurally healthy. Charles publicly stated that **"without leadership change, it will fail"**, while separately **defending ambassadors with a "no troll feed" posture**. Cardano governance culture is now exhibiting **mature-stage self-cleansing behavior**.

### US — Charles vs CLARITY Act Structural Critique (Apr 26)

In an Apr 26 interview, Charles Hoskinson criticized the CLARITY Act as **"structurally disadvantageous to the industry as a whole"**, citing the unamendable nature of the 1933 Securities Act, the 3-layer process corruption, and the fatal flaws of "Security by Default." Critically, on **May 2, Ripple CTO David Schwartz publicly aligned with Hoskinson's CLARITY pushback**. Ripple historically has its own SEC litigation lineage; alignment with Cardano on "industry-wide interest" against CLARITY's structural problems is a first-time event.

### Japan — Continued Implementation Phase

Following W17's FSA final-guideline disclosure (Apr 23), W18 entered a **regulatory implementation continuation phase**. No new regime-level moves, but the following progressed quietly:

- Crypto ETF application early signals (Rakuten Wallet XRP conversion service launch = Apr 30)
- Industry calibration on the 20% separate-taxation implementation framework
- Japan Airlines starting humanoid-robot airport-operations trial — broadening institutional acceptance of AI's physical layer

---

## 4. Midnight Notes — Architecture Paradigm Shift Made Visible

### Midnight Explorer v2.0.0 LIVE (Apr 28) — Near-Zero Downtime Upgrade

Midnight Explorer v2.0.0 went live Apr 28. The point of note is that the upgrade itself was executed **near-zero downtime**. This signals that Midnight has moved from **"early-stage chain that pauses to upgrade"** to **"infrastructure that evolves while in operation"** — the operational maturity of Cardano UTxO + Partner Chain architecture made visible at implementation layer.

### USDM Michigan Money Transmitter License Approved (Apr 28)

USDM (Cardano-native USD stablecoin) received **Money Transmitter License (MTL)** approval from Michigan. This is the **first US state-level regulatory record for any Cardano-native stablecoin**, and combined with W17's VIA Labs USDM × Midnight integration, the trio of **"Cardano-native stable + Midnight ZK privacy + Michigan MTL"** is now in place. A privacy-enabled settlement path with US regulatory record — for institutional use cases (payroll, supply-chain settlement, B2B remittance) — has entered implementation in the Cardano ecosystem.

### Charles "Midnight fixes this" + Nightstream + MPC DVN (Apr 26)

On Apr 26 Charles Hoskinson publicly remarked **"Midnight fixes this."** The reference is to **Nightstream (Midnight × cross-chain transfer) + MPC DVN (Multi-Party Computation Decentralized Validator Network)**, addressing the structural problems of multichain × wrapped-asset DeFi. The triplet of **EUTXO × ZK × MPC** is now functioning as a structural answer to the post-Kelp-DAO wrapped-bridge L2 thesis.

### NIGHT Crosses 69,000 Holders (Apr 27)

NIGHT token holder count crossed 69,000. With price -14.77% W-o-W, the structural increase in holders shows the canonical **"price lags, usage leads"** pattern. The W17 verdict — NIGHT as a short-term-flow-dominated volatile indicator — should be carried into W18.

### 1AM CLI for Midnight Developers (May 1)

1AM released CLI developer tools for Midnight. With **Midnight Node 1.0.0 RC (W17) → Explorer v2.0.0 LIVE (W18) → CLI dev tools (W18)**, the three-layer infrastructure stack is operationally complete. The physical barrier to developer onboarding has dropped by another step.

### Charles Consensus 2026 Main Stage — May 14-16 Preview (May 1)

IOG officially announced Charles's main-stage appearance at Consensus 2026 (May 14-16, Toronto). The theme — **"Agents · Privacy · Blockchain"** — aligns precisely with SITION's Trinity Doctrine (AI agents = financial protagonists / blockchain = trust layer / privacy = non-negotiable). **Midnight × Cardano UTxO × AI Agent Economy** is set to land on a Tier-1 crypto conference main stage for the first time.

### Charms Beaming — BTC Lands on Cardano Mainnet as eBTC (Apr 29)

On Apr 29, the Charms Beaming project landed BTC on Cardano mainnet as **eBTC**. This is the first production case of **"Bitcoin DeFi natively landing"** without a wrapped-bridge intermediary. Combined with Hydra v2 alpha (collectCom phase removed), the design of **Cardano as the trust layer for Bitcoin DeFi** is starting to come into focus.

### Cardano Foundation × Grant Thornton Audit (May 2) — World-First Onchain Financial Audit

Cardano Foundation published the **Grant Thornton financial audit** — described as the **world-first case of Reeve onchain financial statement audit**. This is a structural answer to transparency demands from institutional investors and regulators.

### IOG Formal Verification Milestone (Apr 29) — Romain Soulat

The IOG High Assurance team (led by Romain Soulat) achieved **automated formal verification of Cardano smart contracts**. This is the strongest implementation-layer evidence of **Cardano UTxO + formal verification's structural advantage** over the EVM-side hack pattern (W16 Kelp DAO $293M). The EUTXO × EVM Divergence doctrine (established Apr 23) is now demonstrated in code.

---

## 5. Risk Digest

| Dimension | Level | Notes |
|---|---|---|
| Technical | **LOW** | Node 10.7.1 mainnet-ready, Daedalus 8.0.0 + Mithril bootstrap, Lace 2.0 multichain live, Hydra v2 alpha (collectCom removed), Charms Beaming with BTC eBTC landed, formal-verification milestone achieved. Implementation-layer risk continues to decline. |
| Governance | **MEDIUM** | Intersect CC election May 1 → extended to May 8. IOG 2026 budget $46.8M (-52% YoY); CIP-159 microfee + multi-asset treasury proposed. Pondora zero-treasury controversy = self-cleansing in motion. SIPO DRep #11 / 1,010 maintained. |
| Regulatory | **MEDIUM (continuing)** | US: Charles vs CLARITY structural critique → Schwartz (Ripple CTO) alignment broadens "industry-wide interest" framing. FOMC Apr 29-30 cleared; Powell de-facto final press. JP: Implementation-phase post-FSA-final-guidelines (W17), Rakuten Wallet XRP conversion launched. |
| Market | **MEDIUM (↘ improving)** | VIX 16.99 (-9.19% W-o-W) — vol absorption deepens. USDJPY 157.033 (-1.44%) — sharp yen strength, carry unwind regime. Crude WTI/Brent intraweek spike absorbed by close. BTC +0.98%, SPX 7,230 record-territory. COIN -4.27% remains single-issuer drag. |
| Architecture | **LOW (advantage materializing)** | Lace 2.0 multichain (Cardano + BTC + Midnight) = first frontend out of closed-island posture. IOG L2 full stack (Midgard + Hydra + optimistic rollup) = wrapped-bridge L2 alternative on official roadmap. Filecoin × Cardano official conversation extends UTxO outward. Formal verification milestone = code-level evidence of advantage over EVM hack pattern. |

**Overall**: **MEDIUM (↘ improving)**

---

## 6. Next Week Preview

Five focus points for W19 (May 3 - May 9).

1. **Intersect CC Election May 8 Final Deadline** — extension's final week. SIPO DRep #11 will execute final vote and publish voteContext (CIP-100 bilingual). Milestone event in which Cardano governance settles constitutional-layer personnel by DRep vote.
2. **van Rossem HF Governance Action — pre-disclosure for May 28 GA submission** — the public-disclosure draft skeleton expected during W19. Final operational stage of Plutus V5 deployment prep.
3. **Consensus 2026 (May 14-16, Toronto) — final-week prep for Charles main stage** — the "Agents · Privacy · Blockchain" theme places Trinity Doctrine on a Tier-1 conference main stage. The decisive moment for outward communication of Midnight × Cardano UTxO × AI Agent Economy.
4. **Cardano official x402 integration enters production** — the AI agent payment standard (x402) Cardano integration announced at end of W17 will run in parallel with Stripe's "Link Wallet for Agents" (W18 close). W19 may be the week the **AI Agent Economy descends into the application layer**.
5. **Q2 institutional rebalance window and BTC ETF flow continuity** — early-May rebalances will test whether BTC ETF monthly inflow holds its structural-net positive footing. Whether COIN's cumulative drawdown (-11% W17 / -4.27% W18) translates into direct-exposure substitution is the inflection signal.

**W17 (adopted → designing) → W18 (closed island → sovereign hub) → W19 (descending into application layer)** — three consecutive weeks of Cardano's structural transition manifesting at implementation. W19 will be the final outward-tuning period before Charles takes the Consensus 2026 main stage.

---

**Published by**: LiveMakers (SITION Group)
**SIPO**: DRep **#11** · SPO ×3 · Midnight Ambassador
**Sources**: Koios · DefiLlama · CoinGecko · Dune Analytics · Twitterapi.io · GitHub · SEC EDGAR · Gazette Japan · Intersect MBO · IOG Essential Cardano

*Not investment advice. For institutional research purposes only.*
