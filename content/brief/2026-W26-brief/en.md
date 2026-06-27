# LiveMakers Weekly Brief — W26 / Jun 21 - Jun 27 2026

**The Window That Didn't Open — van Rossem Stays Unforked Past 6/23, ADA Hits a 5-Year Low, and the Leios Testnet Launches**

**Published**: 2026-06-27 JST · **Epoch**: 639 · **Issue #12**

---

## Executive Summary

W25 ended with a prediction: the van Rossem mainnet hard-fork governance action had been submitted (6/17), the enactment window opened ~6/23, and "next issue should record it as done." **W26's most important honest update is that it isn't.** As of writing, Koios measures mainnet `protocol_major` at **10** at epoch 639 — the chain has **not** forked to Protocol Version 11. The governance action remains in its voting/ratification path (submission ≠ ratification ≠ enactment, the framing this brief has held since W22), and the ~6/23 window passed without a clean mainnet fork. The build is real, but this week it slipped its clock.

The macro regime, meanwhile, hardened from W25's "hawkish but orderly" into a broader, AI/tech-led risk-off. US equities rolled over — the **Nasdaq fell ~-4.6% W-o-W into a multi-session losing streak**, the S&P -2.0%, while the Dow held (+0.6%). The W25 weak-yen Nikkei melt-up **reversed (-3.1%)**, the **VIX climbed back to ~18.4 (+12.3%)**, gold gave back -2.9%, and oil slid further (WTI -7.1%, Brent -7.3%) as Strait-of-Hormuz transit reportedly normalized. The dollar stayed firm (DXY +0.5%, USDJPY ~161.7). The liquidity squeeze implied by Warsh's 6/17 hawkish pivot played through risk assets — and this time it reached crypto.

Crypto fell with the tape. ADA dropped **-8.1% W-o-W to ~$0.148**, having printed a roughly **5-year low near $0.16 on 6/22** (a sharp +6.25% 24h bounce was underway at the W26 reference capture). BTC -5.0%, ETH -7.6%, and the long tail was worse (DOT -10.9%, ATOM -11.6%, ALGO -9.0%, FET -6.1%). The clear exception was **SOL (+3.6%)**, tied to a 100B-transaction network milestone. ADA's market cap fell to ~$5.5B and its rank slipped (≈#18 → ≈#21) — the weakest major in a broadly red week.

**The most honest price update concerns NIGHT — and it re-diverged, modestly.** After W25 recorded the three-week decoupling "faded" (NIGHT had moved in line with ADA), W26 shows a partial re-separation: **NIGHT was roughly flat (-0.9% CoinGecko / -1.7% SDE) against ADA's -8.1%.** We treat this exactly as before — an attention-based, not usage-based, signal. Cross-venue dispersion persists and no City V2 usage data has been published, so this stays a **watch item, not a thesis.** The honest pattern across W21→W26 is a decoupling that appears, fades, and reappears with attention flows — durable proof still requires published usage.

**Beneath the missed fork window, the build did advance.** The public testnet for **Ouroboros Leios — "Musashi Dojo" — launched 6/23**, Cardano's next-generation high-throughput consensus (targeting a large multiple of current throughput). The **2026 budget moved on-chain**: of 69 proposals requesting ~331.6M ADA (NCL 350M), **11 cleared the Hydra-voting stage and entered on-chain treasury-withdrawal voting (largest: Intersect Governance 25.4M ADA; deadline ~7/23).** The **Constitutional Committee 2026 election** is in its voting window (10 candidates for 4 seats, closing 7/23). And Midnight's mainnet (Kūkolu) with live DUST continues. The cadence held — only the single most-anticipated item, the mainnet fork, did not land on its window.

**The core of reading W26 is a price-and-build divergence sharpened by timing: a macro-led risk-off pulled crypto to multi-year lows while the build advanced on every front except the one it was supposed to finish.** The posture is two-stage: **short-term (1–4 weeks), watch the actual van Rossem mainnet enactment (now overdue against its own window), whether the AI/tech-led risk-off and the ADA ~5-year-low zone stabilize, and the SPO/tooling readiness that gates the fork; medium-term (2026 H2), watch whether Leios, Pyth (live since W25), and the post-fork toolchain convert into measurable DeFi/RWA usage — the same "does build become usage?" test that NIGHT's on-again-off-again decoupling keeps underscoring.**

---

## 1. Market Pulse — A Macro-Led Risk-Off, an AI/Tech Selloff, and a 5-Year ADA Low

### Week-over-Week (W25 reference snapshot → W26 reference snapshot)

> **Reference times**: W25 reference = 2026-06-20 / W26 reference = 2026-06-27. Crypto is spot at the reference time (W26 = Saturday 6/27 ~12:15-12:30 JST CoinGecko, cross-checked with SITION SDE); traditional markets are the last NY close before reference (W26 = Friday 2026-06-26 close, SITION SDE market_indicators). US 10Y at 4.37% is from a manual cross-check (TradingEconomics + Yahoo) because TNX was missing from the 6/27 SDE auto-capture. NIGHT shows cross-venue dispersion. See meta.json `data_sources`.

| Asset | W25 ref | W26 ref | W-o-W | Note |
|---|---|---|---|---|
| BTC | $63,234 | $60,100 | **-5.0%** | lower with the risk-off |
| ETH | $1,707.4 | $1,577.2 | **-7.6%** | soft among majors |
| **ADA** | $0.16129 | $0.14819 | **-8.1%** | **weakest major; ~5-year low $0.16 on 6/22** |
| **NIGHT** | $0.03100 | $0.03071 | **-0.9%** | **re-diverged (held vs ADA); watch item** |
| **SOL** | $69.30 | $71.79 | **+3.6%** | **only clear gainer; 100B-tx milestone** |
| XRP | $1.13 | $1.059 | **-6.3%** | soft |
| ALGO | $0.09448 | $0.08600 | **-9.0%** | long-tail weakness |
| DOT | $0.95535 | $0.85121 | **-10.9%** | double-digit drop |
| ATOM | $1.81 | $1.60 | **-11.6%** | long-tail laggard |
| ICP | $2.24 | $2.19 | **-2.2%** | relatively resilient |
| FET | $0.19095 | $0.17927 | **-6.1%** | AI names soft too |
| WLFI | $0.05876 | $0.05771 | **-1.8%** | flat |
| **WTI** | $75.57 | $70.24 | **-7.1%** | **lower on reported Hormuz normalization** |
| **Brent** | $79.38 | $73.57 | **-7.3%** | same |
| Gold | $4,223.5 | $4,103.0 | **-2.9%** | gave back |
| **DXY** | 100.814 | 101.366 | **+0.5%** | dollar stays firm |
| **VIX** | 16.4 | 18.41 | **+12.3%** | **fear returns** |
| **SPX** | 7,500.6 | 7,354.0 | **-2.0%** | tech-led pullback |
| **Nasdaq Composite** | 26,517.9 | 25,297.6 | **-4.6%** | **losing streak; AI/tech risk-off** |
| DJI | 51,564.7 | 51,876.1 | **+0.6%** | relatively resilient |
| **Nikkei** | 71,910 | 69,715 | **-3.1%** | **melt-up reversed** |
| US 10Y | 4.451% | 4.37% | **-8.1 bp** | yields lower (flight to quality) |
| USDJPY | 161.36 | 161.73 | **+0.2%** | still in the intervention zone |
| COIN | $163.26 | $149.06 | **-8.7%** | down with equities |

### Macro Regime — From "Orderly" to "Risk-Off"

W25's macro was "hawkish but orderly" — firm dollar, cheaper oil, low VIX, a Fed on hold. **W26 is the week that order broke.** The trigger was not a single event but the liquidity squeeze implied by Warsh's 6/17 hawkish pivot, finally expressing itself as an AI/tech-led equity correction. The **Nasdaq fell -4.6% W-o-W in a multi-session losing streak**, the S&P -2.0%, and the **VIX rebounded to 18.4 (+12.3%)** — the fear that drained in W25 came back. The weak-yen **Nikkei melt-up that defined W25 reversed (-3.1%)**, and oil slid further (WTI -7.1%, Brent -7.3%) as Hormuz transit reportedly normalized to ~70%, draining another layer of geopolitical premium. The dollar held firm (DXY +0.5%, USDJPY ~161.7, still in the intervention zone) and the US 10Y fell -8.1 bp, a flight-to-quality tell. That the Dow held (+0.6%) signals a drawdown led by **tech/AI valuation unwind**, not broad growth fear.

### Crypto Followed Macro Down — A 5-Year ADA Low

The crypto complex that ignored macro in W25 **sold off with it in W26**. The risk-off hit the long tail first (DOT -10.9%, ATOM -11.6%, ALGO -9.0%) and the majors followed (BTC -5.0%, ETH -7.6%). **ADA was the weakest major at -8.1%**, printing a roughly 5-year low near $0.16 on 6/22 (a +6.25% 24h bounce was underway at the reference capture). Market cap fell to ~$5.5B and the rank slipped (≈#18 → ≈#21). The one clear counter-move was **SOL (+3.6%)**, supported by a 100B-transaction network milestone — an idiosyncratic catalyst, not a complex-wide bid. AI-linked FET (-6.1%) moved with the AI equity selloff. This is the third regime in three weeks — W24's bounce, W25's drift, **W26's correlated sell** — and a reminder that crypto can revert to being a dependent variable of macro. Cardano's idiosyncratic catalysts (van Rossem fork, Leios, post-fork DeFi) are in §2 — but this week they did not support price.

### NIGHT — The Decoupling Reappeared, Modestly

W25 recorded that the three-week decoupling had "faded." **W26 is a small swing back the other way** — NIGHT was -0.9% (CoinGecko) / -1.7% (SDE), roughly flat, holding well above ADA's -8.1%. But we do not treat this as a re-confirmed inversion. First, the gap is small for a single week; second, NIGHT's cross-venue price stays dispersed (CoinGecko ~$0.0307, SDE ~$0.0305); third, published City V2 / on-chain usage data is still zero. The W21→W26 pattern is now clear — **the decoupling appears, fades, and reappears with attention flows**, and an attention-based signal has no fixed direction. Durable proof still requires published usage. NIGHT stays a **watch item, not a confirmation.**

---

## 2. Ecosystem Watch — The Fork Window That Slipped, the Leios Testnet That Launched

If §1 is the macro headwind, §2 is the build underneath it — and W26 *missed its own prediction* on the one item this brief has tracked longest.

### van Rossem — Still Unforked Past 6/23

This is the week's most important fact and an honest correction to a forecast this brief itself made. The hard fork staged through W22 ("ratification withheld on Ogmios concerns") → W23 ("PreProd PV11 complete; mainnet go/no-go ~6/15") → W25 ("6/15 GO; mainnet GA submitted 6/17; enactment window ~6/23; *next issue should record it as done*") **has not enacted on mainnet, even past the 6/23 window**. As of writing (2026-06-27), **Koios `cli_protocol_params` measures mainnet `protocol_major` at 10** — the chain is still on Protocol Version 10 and has not forked to PV11. The governance action remains in its voting/ratification path; enactment follows the three-body signature (CC / DReps / SPO) and final readiness of node v11.0.x, DB-Sync, Ogmios, and Kupo. The framing is unchanged — **submission ≠ ratification ≠ enactment.** The fork written as "days, not weeks" away has now missed its window once. This is not a technical failure but a **schedule slip**, and given that SPO/tooling readiness is a precondition, it can be read as cautious gating. The event the next issue should record is unchanged — a clean mainnet fork — but we will no longer state its date as fixed.

### Ouroboros Leios — Public Testnet "Musashi Dojo" Launches (6/23)

In the same week the fork missed its window, Cardano's *next* scaling layer advanced. The **public testnet for Ouroboros Leios, "Musashi Dojo," launched 6/23** (Intersect / Hoskinson announcement; a staged stress test). Leios is a next-generation consensus targeting a large multiple of current throughput (the commonly cited multiples are a *target*, not a guarantee) and is a core piece of the roadmap that runs through the Dijkstra era after van Rossem (PV11). The significance fits §2's through-line — Cardano's constraint has long been "throughput and tooling depth," and W25's live Pyth oracle answered the tooling side while the Leios testnet answers the throughput side. A testnet is not production, but in a week when price sits at a multi-year low, the most ambitious scaling work entering a *public* stage is evidence the build clock has not stopped.

### 2026 Budget — 11 of 69 Proposals On-Chain

On the treasury side, the **2026 budget advanced to its on-chain voting stage.** Of 69 proposals requesting ~331.6M ADA (NCL 350M; Epoch 613→713), **11 cleared Hydra Voting (67%) and moved to on-chain treasury-withdrawal voting on 6/23** (Intersect Weekly Update #117, 6/26). The largest is **Intersect Governance at 25.4M ADA**, alongside Wirex (~3.96M), Mithril (~3.81M, IOG), the TxPipe tooling suite (Tx3 / Dolos / Oura / Pallas / UTxO RPC), hardware-wallet maintenance, MLabs, and TSC support. The **Cardano Foundation voted YES on proposals totaling ~115.4M ADA.** The voting deadline is ~7/23 (Epoch 645). The pattern from W22's "first verdict" and W24's "audit gate" holds — Cardano allocates capital through a process with explicit thresholds and stages, not rubber-stamping. W25's ratification of IO Research's "Vision 2026" (74.96%) sits at the upstream of this 69-proposal cycle.

---

## 3. Governance & Policy — The Fed Squeeze Lands, CLARITY Stalls, Cardano Votes and Budgets

W26's governance axis reads on two layers — the macro follow-through and Cardano's own process.

### US — Warsh's Pivot Lands, and CLARITY Stalls

In W25 the Fed's *communication* changed; in W26 the *consequence* arrived. The "no-easing-signaled" Fed implied by Warsh's first FOMC (6/16-17) — a hawkish-leaning dot-plot and a shift to data-dependence — **unwound liquidity-sensitive AI/tech equities first** (§1). It was the re-pricing of the Fed's *reaction function*, not the rate path itself (10Y -8.1 bp), that hit valuations. On the legislative track, the **CLARITY Act stalled** — it passed Senate Banking (15-9) on 5/14 and reached the Senate calendar (6/1), but ethics-provision talks collapsed 6/9, and Lummis set an end-July floor deadline. Passage needs ~7 Democratic votes and pre-recess prospects are uncertain (reported). Separately, the stablecoin **GENIUS Act has a 7/18 implementation deadline.** The latter is the structural item that matters most directly for crypto; the market-structure bill's delay remains an asset-class sentiment factor.

### Japan — FIEA Heads to the Upper House; the 20% Tax Is a Separate Track

In Japan, the **FIEA amendment reclassifying crypto as financial instruments passed the Lower House on 6/11** and awaits Upper House deliberation (effective ~FY2027), adding securities-style disclosure, insider-trading rules, and tougher penalties. The **flat 20% separate-taxation regime** is a *separate track* under the 2026 Tax Reform Outline, slated for Jan 1, 2028 — conflating it with the FIEA bill is the most common error in Japanese reporting. USDJPY stayed in the intervention zone at ~161.7, with no confirmed BOJ/MOF action this week.

### Cardano Governance — CC Election Voting and the Budget On-Chain

Cardano's own governance is at the thick of its procedural phase. The **Constitutional Committee 2026 election** is in its voting window — 10 candidates for 4 seats, closing 7/23 (W25 cited a 6/23 open; some sources cite 6/28, so we do not state the open day as fixed). As the first substantive CC election under the new constitution, candidate composition and participation will set the depth of Cardano's next committee. The **2026 budget** moved to on-chain voting (§2). And recently, the **Cardano Summit 2026 was rejected by governance vote** (reported ~65.2% vs the 66.7% threshold, late May) — a live demonstration that Voltaire's veto power actually fires. A central bank choosing *discretion* while Cardano moves on *explicit thresholds* — the contrast carried from W25 still holds in W26.

---

## 4. Midnight Watch — NIGHT Re-Diverges; the Build Runs on Its Own Clock

Midnight's W26 is again a study in separating price from progress.

### NIGHT — The Faded Decoupling Swings Back, Slightly

Price is covered in §1; the Midnight read is this — the decoupling W25 recorded as "faded" **swung back slightly in W26.** NIGHT was -0.9% (CoinGecko) / -1.7% (SDE), holding well above ADA's -8.1%. But we do not promote this to a thesis. The swing is small for a single week, the cross-venue price stays dispersed ($0.0305-0.0307), and decisively, **published City V2 / on-chain usage data remains zero.** The W21→W26 arc shows a separation **driven by attention flows — appearing, fading, and reappearing**, whose direction can reverse week to week. Midnight's medium-term thesis does not rest on the weekly NIGHT print — it rests on usage data. W26 keeps NIGHT in the "watch item" slot.

### Build Side — Kūkolu Mainnet, DUST, Roadmap

The build side runs on its own clock. Midnight's **mainnet (Kūkolu phase) has been live since 3/31**, **DUST** — the fee resource for ZK smart contracts — is in production, and NIGHT is tradable, with nine federated validators operating. The roadmap runs Kūkolu (live) → Mōhalu (Q2-Q3, incentivized testnet, SPO block-producer onboarding, DUST Capacity Exchange) → Hua (late 2026, full decentralization, bidirectional bridge with LayerZero) — each timeline a *target*, not a commitment. On the risk side, NIGHT carries structural thaw-unlock sell-pressure through ~Dec 2026. Monument Bank's deposit-tokenization PoC (announced 3/25; the up-to-£250M figure is a planned amount, not confirmed TVL) carries forward as an early enterprise-validation case.

### The W19→W26 Midnight Arc

- **W19–W22**: design → messaging → operations → institutional-phase signaling.
- **W23**: developer/agent layer + NIGHT holding.
- **W24**: budget/audit-gate week.
- **W25**: build funnel widened (accelerator, Turnkey, DUST write-up); NIGHT decoupling faded.
- **W26**: **NIGHT re-diverged slightly (roughly flat vs ADA -8.1%), but attention-based with no fixed direction — a reminder, now one notch stronger, that for Midnight the durable proof is usage data, not price.**

---

## 5. Risk Dimensions

| Dimension | W25 | W26 | Trend | Key drivers |
|---|---|---|---|---|
| **Overall** | MEDIUM → | **ELEVATED ↑** | **up** | macro risk-off reaches crypto; ADA 5-year low; van Rossem misses its window |
| **Macro** | MEDIUM → | **HIGH ↑** | **worse** | Warsh squeeze drives AI/tech selloff (Nasdaq -4.6%, VIX +12.3%, Nikkei melt-up reversed) |
| **Regulatory** | LOW → | MEDIUM → | slightly up | CLARITY stalls toward July deadline (ethics talks collapsed); Japan FIEA advances; GENIUS 7/18 |
| **Architecture** | LOW → | **MEDIUM ↑** | **worse (forward)** | **van Rossem MISSED its ~6/23 window (PV10 still live)** — the one negative surprise; Leios testnet launched |
| **Adoption** | LOW → | LOW → | flat (forward) | Leios + on-chain budget, but price at multi-year lows and NIGHT's signal unresolved |
| **Governance** | MEDIUM → | MEDIUM → | flat | 2026 budget on-chain (11/69) + CC election voting (10 candidates / 4 seats) |

### Dimension Reads

**Overall MEDIUM → ELEVATED**: a step up. W25's "orderly" backdrop broke as the macro risk-off reached crypto and pulled ADA to a 5-year low. Added to that, the van Rossem miss (below) injected a small uncertainty into build-side conviction.

**Macro HIGH ↑ (worse)**: the level rose. The liquidity squeeze from Warsh's 6/17 pivot expressed itself as an AI/tech valuation unwind (Nasdaq -4.6%, S&P -2.0%, VIX +12.3% to 18.4). W25's weak-yen Nikkei melt-up reversed (-3.1%), oil fell -7% on reported Hormuz normalization, and the dollar held firm (DXY +0.5%, USDJPY ~161.7). Watch — (1) the depth and persistence of the AI/tech correction, (2) stabilization of the ADA 5-year-low zone, (3) Fed commentary and hike pricing, (4) the USDJPY intervention line.

**Regulatory MEDIUM → (slightly up)**: CLARITY's stall (ethics talks collapsed 6/9; end-July deadline; ~7 Democratic votes the key) adds uncertainty, while GENIUS (7/18) and Japan's FIEA (to the Upper House) advance as structural buildout. Next gates — the pre-recess CLARITY fight and Japan's Upper House deliberation.

**Architecture MEDIUM ↑ (worse, but forward)**: the one negative surprise. **van Rossem missed its ~6/23 enactment window; mainnet stays on PV10** (Koios protocol_major=10 @ epoch 639). Not a technical failure but a schedule slip — yet a fork written as "days away" missing its window lowers conviction. At the same time, the Leios testnet launched and the build's direction itself moved forward. Next gate — a clean mainnet fork (we will not state a date).

**Adoption LOW → (forward)**: direction forward, proof pending. The Leios testnet and the on-chain budget lower activation barriers, but price sits at multi-year lows and NIGHT's signal is unresolved. The conversion test — do new rails (Leios, Pyth, post-fork toolchain) become measurable usage — remains the medium-term key.

**Governance MEDIUM →**: flat, process-driven. **The 2026 budget moved on-chain (11/69)**, the **CC election is in its voting window**, and the Summit rejection shows the veto power firing. Next watch — early on-chain budget voting (7/23 deadline) and CC election participation/results.

### W26 Thesis and the Risk Dimensions

The thesis — "the fork missed its window, macro sank crypto, and the build advanced anyway" — maps onto the risk dimensions as **Macro deteriorating to HIGH + Architecture's first negative surprise vs still-advancing Governance/Adoption.** The market's energy was not in crypto, nor in a single Cardano event (rather a non-event — the missed fork), but entirely in macro liquidity and risk-aversion. The investment implication condenses to a two-stage posture — **short-term, watch the macro risk-off bottoming and the actual van Rossem enactment (already overdue); medium-term, watch whether Leios, Pyth, and the post-fork toolchain convert into usage — the test NIGHT's on-again-off-again decoupling keeps pointing to.**

---

## 6. Next Week

Six things to watch next week (W27 / Jun 28 - Jul 4):

1. **van Rossem mainnet fork — actual enactment (already past its window)** — whether the submitted governance action clears voting/ratification and mainnet actually forks to PV11. Koios `protocol_major` moving 10→11 is the only definitive signal. Does SPO/tooling readiness hold, or does the slip extend?

2. **Early signals from the Leios "Musashi Dojo" testnet** — first metrics from the next-gen consensus now in its public stage, and stress-test progress. The first read on whether the throughput claim moves from *target* toward *measured*.

3. **Early 2026 on-chain budget voting** — DRep/CC/SPO voting trends on the 11 treasury withdrawals (largest: Intersect Governance 25.4M ADA; deadline ~7/23). Participation and outcomes in a high-density cycle.

4. **The AI/tech risk-off bottoming + the ADA 5-year-low zone** — whether the US equity correction runs its course or deepens, and whether ADA bases around ~$0.16 or breaks lower. The macro item that most drives asset-class sentiment.

5. **US CLARITY Act's end-July deadline + GENIUS 7/18 implementation** — whether the legislative calendar moves after the ethics-talk collapse, and whether the stablecoin regime enters operation.

6. **CC 2026 election voting progress + Japan FIEA in the Upper House** — participation in the 4-seat vote (closing 7/23) and the start of Upper House deliberation on Japan's FIEA amendment.

**W22 (first verdict) → W23 (peak price-build divergence) → W24 (audit gate) → W25 (the Fed changed its voice, the fork loomed) → W26 (the fork missed its window, macro sank crypto)** — the through-line is a market whose energy keeps rotating from crypto to macro (Fed liquidity, AI/tech valuations), while Cardano's build runs on its own clock — except this week, that clock missed its appointment once. The medium-term thesis is unchanged — the signal that matters is no longer price divergence but **usage** — and the moment van Rossem (actually enacted) and Leios/Pyth land together as *measurable usage* is where that test begins in earnest.

---

**Published by**: LiveMakers (SITION Group)
**SIPO**: DRep **#11** · SPO ×3 · Midnight Ambassador
**Data sources**: Koios (tip / totals / cli_protocol_params — protocol_major=10 measured 2026-06-27) · Intersect MBO official (Weekly Update #117) · Input Output official (Leios / Hoskinson announcement) · Cardano Foundation official · gov.tools / cexplorer / adastat (reference) · DefiLlama · CoinGecko · SITION SDE market_indicators (traditional markets 6/26 NY close; crypto 6/27 spot) · Federal Reserve official (federalreserve.gov — 6/17 FOMC statement + SEP) · FSA Japan · Midnight Network official · secondary reporting (Bloomberg / CoinDesk / The Block / Reuters / Axios — marked "reported" in-text)

*Not investment advice. For informational and research purposes only.*
