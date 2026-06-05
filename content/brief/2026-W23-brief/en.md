# LiveMakers Weekly Brief — W23 / May 31 - Jun 6 2026

**The Widening Gap — A Sharp Crypto Correction Meets Cardano's Busiest Build Week as Equities Set Records**

**Published**: 2026-06-06 JST · **Epoch**: 635 (634→635 transition 2026-06-04) · **Issue #9**

---

## Executive Summary

W23 will be recorded as the week the **gap between price and build widened to its largest yet**. In W22, Cardano handed down its "first verdict" while three clocks — governance, equities, long rates — ran at different speeds. In W23 that desynchronization hardened into a **chasm**: digital assets suffered their sharpest correction of the cycle, traditional equities printed fresh records, and underneath the price action Cardano shipped what was arguably its **busiest build-and-adoption week of the year**.

The price side was unambiguous and broad. Over the W22→W23 reference window, **BTC fell -16.5%, ETH -20.7%, SOL -21.5%, and ADA -31.4%** — a fourth consecutive weekly decline that accelerated from a drift into a genuine risk-off. ADA, as a higher-beta L1, fell the most within a complex that was lower across the board; even W22's idiosyncratic gainers reversed (FET -19.2%, ICP -12.1%). This was a **flows-and-sentiment correction** — a continuation of W22's nine-day Bitcoin-ETF outflow regime, compounded by a firm dollar (DXY +0.50%), Middle East risk, and a privacy-asset scare (the Zcash Orchard vulnerability and Arthur Hayes's exit from ZEC) — not a response to any single Cardano-specific event.

Yet **the traditional tape went the other way**. The Dow closed at a **record above 51,500** (+1.0%), the Nikkei rose **+2.0% to ~67,570**, the S&P held flat near records, and the VIX stayed calm in the 15s. The dollar firmed and **USDJPY touched 160.0**, drawing Japanese intervention warnings as reserves were reported to shrink, while **oil rebounded (WTI +5.8% / Brent +3.8%)**, reversing W22's collapse as the unsigned Iran ceasefire framework stayed in doubt. The equity–crypto divergence W22 measured as "records vs. correction" widened in W23 to **"records vs. a double-digit sell-off."**

**The most important observation is what happened underneath that price action.** Far from stalling, Cardano's implementation and adoption engine had one of its densest weeks of 2026. **van Rossem** advanced from W22's withheld ratification to a **PreProd ratification (6/5) and a scheduled PreProd Protocol Version 11 hard fork on 6/10**, with a mainnet go/no-go decision set for ~6/15 (submission 6/15-16 if GO) — the "did not rush, prioritized safety" discipline turning into a concrete calendar. The **Cardano Summit 2026 funding proposal failed** to clear the 66.67% treasury supermajority despite majority support — a clean demonstration that "majority ≠ funded" under Voltaire — and the Foundation will not proceed with Summit 2026. On institutional access, **CME's Cardano (ADA) and Micro ADA futures went live (6/2)**; in DeFi, **Indigo V3 shipped Cardano's first non-USD iAssets (iJPY/iEUR)**, Cardano's **stablecoin supply was cited up ~200% year-on-year**, and Liqwid advanced a 50M-ADA stablecoin-liquidity RFP. Midnight pushed into the developer and AI-agent layer — **Midnight Expert** (a developer AI assistant), an **Agent Identity Standard RFC**, a **Cardano↔Midnight testnet bridge (USDM / VIA Labs)**, and **Hilo hackathon** winners across healthcare, finance, AI, and identity.

The one place where price *confirmed* the build narrative was **NIGHT**. While ADA fell -31% and the majors fell 16–22%, **NIGHT held roughly flat (≈$0.035, +0.4% W-o-W on its highest-liquidity venue)** — a ~30-point relative outperformance and the third straight week it diverged from ADA. The reservation from W22 stands: this is still an **inversion of attention, not of usage** — no City V2 usage data has been published, NIGHT prices remain dispersed and thin across venues, and it gave back a mid-week spike (to ~$0.0382 on 6/1) in the Saturday risk-off. But "held the line through a -31% week in ADA" is a materially stronger decoupling signal than a quiet rally would have been.

**The core of reading W23 is the divergence between price and build at its widest.** The investment implication is a two-stage posture: **short-term (1–4 weeks), watch whether the crypto outflow/risk-off regime stabilizes, whether USDJPY 160 triggers intervention, and whether the 6/10 PreProd PV11 fork stays on schedule; medium-term (2026 H2), trace whether the build density — van Rossem enactment, CME access, non-USD iAssets, Midnight's developer/agent layer — converts into the usage data that would finally turn NIGHT's "attention" decoupling into a "usage" one.**

---

## 1. Market Pulse — Crypto's Sharpest Correction, Equities at Records, the Gap Widens

### Week-over-Week (W22 reference snapshot → W23 reference snapshot)

> **Reference timestamps**: W22 reference = 2026-05-30 / W23 reference = 2026-06-06 (~07:15 JST capture). Crypto is spot at the reference timestamp; traditional markets are the last NY close prior to reference (W23 = Friday 2026-06-05 NY close). NIGHT is the highest-liquidity venue, cross-checked; cross-venue dispersion is noted below. See meta.json `data_sources` for detail.

| Asset | W22 ref | W23 ref | W-o-W Δ | Note |
|---|---|---|---|---|
| BTC | $73,404 | $61,305 | **-16.5%** | Below $62K · 4th straight weekly decline |
| ETH | $2,011.4 | $1,594.3 | **-20.7%** | Lost $1,600 intraweek |
| ADA | $0.23292 | $0.16011 | **-31.3%** | Higher-beta L1 · fell most within a broad sell-off |
| **NIGHT** | $0.03494 | **~$0.0351** | **~flat (+0.4%)** | **Held the line · 3rd straight week diverging from ADA** |
| SOL | $81.83 | $64.25 | **-21.5%** | Tracking high-beta risk |
| XRP | $1.32 | $1.10 | **-16.7%** | Relatively resilient among majors |
| ALGO | $0.11968 | $0.09384 | **-21.6%** | Gave back W22's gain |
| DOT | $1.19 | $0.95089 | **-20.1%** | Below $1 |
| ATOM | $2.02 | $1.66 | **-17.8%** | High-beta decline |
| ICP | $2.64 | $2.32 | **-12.1%** | **W22 gainer reversed** |
| FET | $0.24507 | $0.19812 | **-19.2%** | **W22's top gainer reversed** |
| WLFI | $0.05869 | $0.05709 | **-2.7%** | One of the few that held |
| WTI | $87.76 | $92.83 | **+5.78%** | **Rebounded on Middle East risk** |
| Brent | $91.70 | $95.20 | **+3.82%** | Reversed W22's collapse |
| Gold | $4,569.9 | $4,503.3 | **-1.46%** | Eased from elevated levels |
| DXY | 98.942 | 99.432 | **+0.50%** | Firmer dollar |
| VIX | 15.32 | 15.4 | **+0.5%** | **Stayed calm — no equity fear** |
| **SPX** | 7,580.1 | 7,584.3 | **+0.06%** | Flat, near records |
| Nasdaq Comp | 26,972.6 | 26,831.0 | **-0.53%** | Marginally lower |
| **DJI** | 51,032.5 | 51,561.9 | **+1.04%** | **Fresh record close above 51,500** |
| **Nikkei** | 66,220.0 | 67,570.0 | **+2.04%** | Near record highs |
| US 10Y | 4.453% | 4.477% | **+2.4 bp** | Long end broadly steady |
| **USDJPY** | 159.255 | 159.998 | **+0.47%** | **Touched 160.0 · intervention warning** |
| COIN | $189.03 | $164.13 | **-13.17%** | Crypto-equity tracked crypto down |

### Macro regime — a crypto-specific risk-off, not a broad one

The defining feature of W23's macro picture is that **the sell-off was concentrated in digital assets, not in risk assets generally.** While crypto fell 16–31% across the board, the VIX held in the 15s, the Dow set a record, and the Nikkei pushed toward its highs. This was **not** a 2022-style "everything down" deleveraging; it was a sector-specific correction within an otherwise calm — even buoyant — risk environment.

The drivers were flows and sentiment rather than a single headline. W22's **nine-day Bitcoin-ETF outflow streak** carried into W23 as a fourth consecutive weekly decline, this time accelerating. A **firmer dollar** (DXY +0.50%, with USDJPY pressing 160.0) tightened global liquidity at the margin; the **oil rebound** (WTI +5.8% / Brent +3.8%, reversing W22's collapse) reflected renewed Middle East risk as the Iran ceasefire framework stayed unsigned; and a **privacy-asset scare** — the reported Zcash Orchard shielded-pool vulnerability and Arthur Hayes's exit from his entire ZEC position on 6/5 — added a thematic chill to one corner of the market (covered in §4). None of these is Cardano-specific. ADA fell the most simply because, as a higher-beta L1, it carries more of the complex's directional risk in both directions; the magnitude is a beta statement, not a verdict on the week's fundamentals — which, as §2–§4 show, ran the other way.

A word on **USDJPY at 160.0.** The yen's slide to the 160 line, reported alongside warnings of FX intervention as reserves shrink, is the macro item most worth watching into next week. 160 has historically been a psychological intervention threshold; a defensive move by Japanese authorities would ripple through dollar liquidity and, by extension, risk assets including crypto. We treat 160 as a live macro trigger, not a settled level.

### Equities at records, crypto left behind for a fourth week

The equity–crypto desynchronization that W22 framed as "records vs. correction" widened in W23 into its starkest form. The **Dow closed at a fresh record above 51,500** (+1.0%), the **Nikkei rose +2.0%** toward record territory, the **S&P held flat** at 7,584 just below its highs, and the **Nasdaq Composite slipped only -0.53%.** With the VIX in the 15s, traditional markets showed no fear.

Crypto, by contrast, **extended a fourth straight weekly decline and accelerated** — BTC -16.5% / ETH -20.7% / SOL -21.5% / ADA -31.3% / DOT -20.1%. Notably, **W22's idiosyncratic winners reversed**: FET, the prior week's +22.57% leader, fell -19.2%, and ICP, up +5.18% in W22, fell -12.1%. The narrative-rotation bid that had concentrated capital in AI tokens unwound as the broader risk-off deepened. **As equities set records, digital assets alone were left in an accelerating, flow-driven correction** — the W23 confirmation and intensification of the "crypto does not move with the macro tape" thesis carried from W20–W22. The difference: W22 was "equities at records, crypto in a measured correction"; W23 is "equities at records, crypto in a double-digit sell-off."

### NIGHT held the line — the decoupling, stated honestly

The single asset that broke from the complex was **NIGHT.** While ADA fell -31% and the majors fell 16–22%, **NIGHT held roughly flat — approximately $0.035 on its highest-liquidity venue, +0.4% week-over-week** — a relative outperformance of roughly 30 points versus ADA and the third consecutive week it has diverged from Cardano-L1 beta (W21 / W22 / W23).

Three caveats keep this honest. First, **NIGHT did not rally; it held.** Intraweek it spiked toward ~$0.0382 on 6/1 and then gave that back in the Saturday risk-off — the W-o-W "flat" masks a round trip, not a steady climb. Second, **NIGHT's price is dispersed and thin across venues** — quotes ranged from roughly $0.022 to $0.035 depending on the chain and pool — so any single figure should be read as an estimate, not a settled mark. Third, and most important, the reservation carried from W20–W22 is unchanged: **no City V2 usage data — user or transaction counts — has been published.** NIGHT's relative strength is therefore still an **inversion of attention**, not a demonstrated **inversion of usage.**

What changed in W23 is the **conviction the signal carries.** A token holding flat through a quiet week is unremarkable; a token holding flat while its parent-chain asset falls nearly a third, in the worst crypto week of the cycle, is a genuine separation. NIGHT is increasingly trading on its own ecosystem narrative rather than as a Cardano-L1 proxy. Whether that separation earns its backing from "attention" into "usage" is the medium-term question §4 returns to.

---

## 2. Ecosystem Watch — van Rossem Reaches PreProd PV11, CME Lists ADA Futures, Indigo Ships Non-USD iAssets

Reading W23 through Cardano's implementation and adoption lens, the single biggest observation is that **the build cadence accelerated precisely as price fell.** Nearly every open thread from W22 advanced — and several moved from "planned" to "dated" or "live."

### van Rossem — from withheld ratification (W22) to PreProd PV11 on 6/10

W22's most instructive event was that the van Rossem (V11) hard fork, voted on schedule, was **not** rushed to ratification — the Hard Fork Working Group withheld its recommendation over Ogmios readiness. In W23 that discipline produced a concrete next step: **Cardano's PreProd testnet ratified the van Rossem hard-fork action on 6/5 (00:00 UTC), and PreProd is scheduled to hard-fork to Protocol Version 11 on 6/10 (00:00 UTC)** (Intersect MBO official · PreProd AdaStat). The Hard Fork Working Group has set a **mainnet go/no-go decision for ~6/15** (with the mainnet hard-fork governance action submitted 6/15-16 if the decision is GO), and effective mainnet enactment up to ~5 weeks later, once the three-layer sign-off (CC / DReps 67% / SPOs) and infrastructure readiness (node v11.0.1, DB-Sync 13.7.1.0, Ogmios, Kupo) are complete.

The structural point is the same one W22 made, now one step further: **"submitted ≠ ratified ≠ enacted,"** and Cardano is moving through those stages deliberately. PreProd ratification is a rehearsal, not the main event; SPOs and tooling operators now have a dated PreProd fork to validate against before any mainnet go/no-go. The "no-rush, safety-first" posture is intact — and increasingly legible as a calendar rather than a delay.

### CME lists Cardano (ADA) and Micro ADA futures (6/2)

On the institutional-access side, **CME Group's Cardano (ADA) futures and Micro ADA futures went live on 6/2** (CME official), alongside Chainlink and Stellar. This is **distinct** from two other CME items readers should not conflate: the **24/7 crypto trading launch** (5/29, W22, which included ADA among ten assets) and the **CME × Nasdaq crypto index futures** (target 6/8, still pending regulatory review). The 6/2 launch is a set of listed, regulated futures contracts on ADA itself — a channel through which institutional capital can take Cardano exposure inside the regulated-derivatives perimeter. That this arrived in the same week ADA spot fell -31% is itself the W23 thesis in miniature: the **access rails for ADA thickened as ADA's price thinned.**

### DeFi — Indigo's non-USD iAssets, a stablecoin supply up ~200% YoY, Liqwid's RFP

Cardano DeFi shipped against the falling tape. **Indigo V3 went live with iJPY and iEUR — described as Cardano's first non-USD synthetic iAssets** (Indigo Protocol official), with NIGHT collateral planned. Non-USD synthetics matter structurally: they extend Cardano's synthetic-asset surface beyond the dollar and create on-chain yen/euro exposure that is natively composable. On the stablecoin side, **Cardano's stablecoin supply was cited up roughly 200% year-on-year** (Token Terminal data, shared by IOG on 6/1), even as the on-chain stablecoin market cap sits near ~$48M (DefiLlama) — small in absolute terms, but growing off a low base. **Liqwid Finance** advanced a **50M-ADA Stablecoin Liquidity Budget RFP** (Governance Space #314) plus LIP-148/149 (USDCx and stableswap LP rates) and announced a NIGHT airdrop with updated USDCx fee/borrow conditions. Separately, **Cardano partnered with Token Terminal** (6/3) to surface fees, users, revenue, and validator metrics for external comparison — a transparency step that lets institutions benchmark Cardano against other chains on standardized on-chain data.

### Leios, Hydra, and the epoch — scaling moved from "vision" to "dated testnet"

The scaling roadmap firmed. **Leios's first public SPO testnet is dated for June** (aggregate-sourced; primary reconfirmation advised), and the Consensus Initiative that funds it shows a **Ratified status on CGOV with ~87.7% DRep support** (IOGroup official; CIP-0164 Ouroboros Linear Leios). **Hydra partial-fanout** progress was shared (6/6, IOG), advancing the L2 scaling path, and post-quantum migration research continued. **Epoch 635 began on 6/4** (634→635), on schedule. The throughline: Leios is no longer a "someday" answer to scaling criticism but a near-term environment SPOs will actually touch.

### TVL — softened with ADA, as expected

**Cardano TVL fell to ~$92M** (DefiLlama), down roughly 28% from W22's ~$128M. Because much of Cardano TVL is ADA-denominated, a -31% move in ADA mechanically compresses the dollar figure; the decline is best read as a price effect, not a flight of deposits. The protocols themselves kept shipping (Indigo V3, Liqwid LIPs), which is the more durable signal.

---

## 3. Governance Update — Summit Funding Fails the Supermajority, committeeMinSize, and the Macro-Regulatory Layer

W23's governance layer moved on two axes — **Cardano-internal treasury and constitutional mechanics** and **US/Japan macro-regulation.** The internal axis is the protagonist, and its lesson is about thresholds.

### Cardano Summit 2026 funding — majority support, but short of the supermajority

The week's clearest governance lesson was a **rejection by threshold.** A Treasury proposal of roughly **7.8M ADA to fund the Cardano Summit 2026** drew majority support — reported around 65% — but **fell short of the 66.67% supermajority required for a treasury withdrawal**, and so **did not pass** (The Block · cgov.io, where the action shows Expired; reported tally 135 Yes / 61 No / 24 Abstain, with the stake-weighted threshold deciding). As a result, **the Cardano Foundation will not proceed with Summit 2026**, and Hoskinson floated, on X, the idea of a smaller, community-led, distributed event in its place.

The instinct to read this as dysfunction misses the design. **Under Voltaire, "a majority in favor" and "funds released" are deliberately different things.** A two-thirds bar on spending the community's treasury is a feature: it forces broad consensus before capital leaves the treasury, and it means a simple majority cannot commit shared funds over a substantial minority's objection. The Summit outcome is the **same discipline van Rossem showed in W22**, expressed on the budget axis rather than the protocol axis — the chain declining to act until a high bar is cleared. A flagship event failing to clear that bar is a more credible signal of governance integrity than a rubber-stamped approval would have been. SIPO, as DRep #11, participates in exactly these threshold decisions.

### committeeMinSize 7→5 — an operational buffer, not a downsizing

A governance action submitted on 6/6 proposes lowering **committeeMinSize from 7 to 5** (Intersect MBO · GovTools). It is worth stating precisely what this does and does not mean: it is **not** a reduction of the sitting Constitutional Committee, which remains a 7-member body. It is an **operational buffer** — a parameter ensuring the committee can still function (and the chain can still ratify governance actions) if seats fall temporarily vacant below seven, rather than stalling. The watch item is whether DReps and CC candidates read it as "resilience engineering" or as "lowering the bar," and how clearly the rationale is communicated before the vote.

### US — CLARITY moves to the tax and banking-access fight; Warsh's Fed; CME

On US market structure, the **CLARITY Act** continued to advance, but the center of gravity shifted from the headline committee vote to **implementation contestation.** Having cleared the Senate Banking Committee 15-9 (recorded in W22), the bill's W23 motion was in the **tax provisions, banking-lobby pushback (JPMorgan's Dimon, reported), pressure from Senator Lummis, and a new developer-protection PAC** — while it still awaits the full Senate floor (60 votes). We make no claim about floor timing, which remains unresolved (some see June, others later). The substance to track is whether the bill survives the tax and banking-access negotiations intact.

On the Fed, **Chair Warsh delivered no policy speech in W23**; the bank-capital-rule debate continued, **Governor Waller appeared on a stablecoin panel**, and the Fed **removed "reputation risk" language from supervisory guidance (6/2)**, a step that eases banks' access to crypto clients. The next SEP (dot-plot) meeting is **6/16–17**, outside W23. On products, the **CME ADA futures launch (6/2)** discussed in §2 is the week's confirmed institutional-access event; the **CME × Nasdaq index futures (6/8 target)** remain pending regulatory review, and because the regulator is not named in official statements, we assert neither SEC nor CFTC.

### Japan — the Funds Settlement Act is now in force (6/1)

In Japan, the amended **Funds Settlement Act and its implementing ordinances took effect on 6/1**, moving from "confirmed ahead of enforcement" (W22) to **operational.** The new **"Electronic Payment Instrument / Crypto-Asset Service Intermediary Business"** category — a lighter regime for intermediation-only operators that do not custody user assets, but carrying disclosure, advertising, and record-keeping duties — is now live, alongside the domestic asset-holding order and the diversification of trust-type stablecoin backing. The FSA also published an **FSB plenary summary (6/2)**, signaling continued engagement on international coordination. How Cardano's Japan grounding — the EMURGO × SecondFi × Slash Cardano Card thread carried from W22 — moves within this post-enforcement frame is a concrete W24-onward watch item.

---

## 4. Midnight Watch — The Developer-and-Agent Layer, and NIGHT Holds the Line

Having previewed "the institutional phase" in W22 (guarded-period-ending → next hard fork), Midnight in W23 **filled in the layer beneath that headline** — the developer tooling, agent-identity standards, and cross-chain plumbing that a privacy network needs before institutions and AI agents can actually use it.

### Midnight Expert, an Agent Identity Standard, and a Cardano↔Midnight bridge

Three concrete builder-facing items shipped or surfaced. **Midnight Expert**, a developer-focused AI assistant for building privacy-preserving applications, was published (6/4) — explicitly aimed at lowering the learning curve for Midnight's ZK development model. An **Agent Identity Standard RFC (MAIS)** was opened on the Midnight forum (6/1), proposing how autonomous agents establish identity and selective disclosure — a direct bid for relevance in the **AI-agent economy**, where agents that transact need verifiable identity without surrendering privacy. And a **Cardano↔Midnight testnet bridge** using **USDM via VIA Labs** was presented (6/4, reinforced 6/6 by the Japanese account), making the connection between the two networks observable as a native asset moving across them. Midnight Japan continued pushing developer hangouts, IVS event presence, and the Night Sky onboarding funnel; a **State of the Network (May 2026)** was published (6/1). One caution surfaced: a **Midnight Explorer account-takeover warning** circulated, and the prudent reader-facing note is to verify official links before connecting anything.

### Hilo hackathon winners — privacy DApps across four verticals

Midnight published its **Hilo hackathon winners (6/5)**, a useful grounding of "privacy as a concept" into shipped applications: **Tartufo** (grand prize, healthcare), **Fairway** (finance), **Oblivion Protocol** (AI), and **Black8** (identity). The spread across healthcare, finance, AI, and identity is the point — these are the four verticals where selective disclosure is not a nice-to-have but a prerequisite, and a hackathon producing one credible team in each is an early signal that the developer story is broadening beyond demos.

### The privacy-asset stress test — Zcash, and why NIGHT's hold matters more

W23 also delivered a **stress test of the privacy thesis itself.** A **soundness vulnerability in Zcash's Orchard shielded pool was reported (6/5)** — a flaw that, in principle, could have allowed counterfeit ZEC — and **Arthur Hayes sold his entire ZEC position** citing it. The vulnerability was reported as fixed, with actual exploitation framed as unlikely (The Block); we do **not** assert that counterfeiting occurred, and the careful distinction is between *an unproven possibility* and *a proven exploit.* The deeper point is thematic: privacy assets derive their value from **cryptographically provable** assurances, and the market was reminded that "probably safe" is not the same as "provably safe." Against that backdrop, **NIGHT holding its value in the same week** is more notable, not less — the privacy corner took a sentiment hit and NIGHT did not break.

### NIGHT's decoupling — the third straight week, stated soberly

NIGHT's W23 behavior is covered in detail in §1; the Midnight-side reading is this. The decoupling from ADA is now a **three-week pattern** (W21 +1.21% relative, W22 +5.81% relative, W23 ~flat vs ADA -31%), and W23 is the most convincing instance because it occurred in the worst week for the complex. But the **usage-data reservation is unchanged**: City V2's user and transaction figures remain unpublished, NIGHT's cross-venue pricing is thin and dispersed, and the W23 "flat" includes a round-trip spike. The honest reading is that NIGHT is **building an attention base independent of ADA** — necessary, but not sufficient. The conversion test arrives with the **Mōhalu phase (mid-2026)**: Cardano-SPO opening, the incentivized testnet, the DUST Capacity Exchange, and staking rewards. Those are the events that would put **usage numbers** behind the price separation.

### The W19→W23 Midnight story arc

- **W19**: Trinity Goes Live — Midnight as one axis of an AI-agent sovereign-finance layer (design phase).
- **W20**: "The answer is Midnight" — a messaging consolidation phase.
- **W21**: City V2 + Cardano Card Japan — an operational phase, descending as a working app.
- **W22**: "Guarded period ending → next hard fork" + Monument £250M resurfaced — a preview of the institutional phase.
- **W23**: **Midnight Expert + Agent Identity Standard + Cardano↔Midnight bridge + Hilo winners — the developer-and-agent layer that the institutional phase will stand on.** NIGHT held the line through the cycle's worst crypto week — an attention separation awaiting its usage proof.

---

## 5. Risk Dimensions

| Dimension | W22 | W23 | Trend | Key drivers |
|---|---|---|---|---|
| **Overall** | MEDIUM → | **MEDIUM ↗** | rising on price/flows | Sharp 4th-week crypto correction vs. stable-to-forward fundamentals → net tilts up |
| **Macro** | MEDIUM → | **MEDIUM ↗** | rising | Crypto -16/-31% vs. equity records + USDJPY 160 (intervention warning) + oil rebound; a crypto-specific risk-off |
| **Regulatory** | LOW → | LOW → | flat | CME ADA futures live + FSA Act enforced 6/1 / CLARITY contested, awaiting floor |
| **Architecture** | LOW → | LOW → | flat (forward) | van Rossem PreProd PV11 6/10 / Leios June testnet / node v11.0.1 / Hydra partial fanout |
| **Adoption** | LOW → | LOW → | flat (forward) | CME access + non-USD iAssets + Midnight dev/agent layer — but price soft, usage unproven |
| **Governance** | MEDIUM → | MEDIUM → | flat | Summit-funding discipline (supermajority) + van Rossem cadence + committeeMinSize |

### Dimension reads

**Overall MEDIUM ↗**: The tilt up is honest and price-driven, not fundamental. A sharp, accelerating, fourth-week crypto correction (with ADA down nearly a third) raises near-term market risk, while the build/governance/adoption layers are stable-to-forward. The net is a modest increase in overall risk, concentrated in the price/flows channel.

**Macro MEDIUM ↗**: The key change from W22. What makes W23's macro risk distinctive is its **asymmetry** — a double-digit crypto sell-off coexisting with equity records and a calm VIX, i.e., a crypto-specific risk-off rather than a broad one. The watch items: (1) whether the ETF-outflow/risk-off regime stabilizes, (2) whether USDJPY 160 triggers Japanese FX intervention, (3) the durability of the oil rebound and the unsigned Iran framework, (4) the 6/16–17 FOMC's first read on Warsh-era policy, and (5) whether crypto's correction finds a floor or extends to a fifth week.

**Regulatory LOW →**: Flat. Institutional and statutory progress (CME ADA futures live; FSA Funds Settlement Act in force 6/1; Fed easing bank crypto access) coexists with the unresolved CLARITY floor. Next gates: the CLARITY tax/banking negotiations, the CME × Nasdaq index-futures regulatory review (6/8), and post-6/1 operational interpretation of the FSA category.

**Architecture LOW → (forward)**: The implementation pipeline accelerated. **van Rossem reached PreProd ratification and a dated PreProd PV11 fork (6/10)**, Leios obtained a June testnet, node v11.0.1 is the readiness baseline, and Hydra partial fanout advanced. The next gate is a clean PreProd PV11 fork followed by the mainnet go/no-go (~6/15) and a June–July enactment window.

**Adoption LOW → (forward)**: Level unchanged, direction forward. **CME ADA futures, Indigo's non-USD iAssets, the stablecoin-supply growth, and Midnight's developer/agent layer** all advanced — but **price fell and usage data is still unpublished**, so proof has not caught up with progress. Whether the "attention" decoupling (NIGHT) becomes a "usage" one is the medium-term key.

**Governance MEDIUM →**: Flat, and qualitatively reassuring. The **Summit-funding failure (supermajority not met)** and the deliberate **van Rossem cadence** both show a chain that declines to act until a high bar is cleared, while **committeeMinSize** addresses operational resilience. Next watch items: whether the three rejected/expired threads (Summit, and W22's Pogun/Blockfrost/Layer-2) are resubmitted, and how committeeMinSize is received.

### W23 thesis and Risk Dimensions

The "price-vs-build divergence at its widest" thesis from §1 maps onto Risk Dimensions as **Macro rising (a crypto-specific sell-off) while Architecture, Adoption, and Governance hold stable-to-forward.** That is the structural shape of W23: the market repriced crypto sharply downward, even as the chain's implementation and adoption layers had one of their busiest weeks. The investment implication condenses into a two-stage posture — **short-term, watch whether the crypto risk-off stabilizes and whether USDJPY 160 forces intervention; medium-term, trace whether the build density converts into the usage data that would validate the NIGHT decoupling and re-anchor price to fundamentals.**

---

## 6. Next Week Preview

Five watch items for next week (W24 / Jun 7 - Jun 13):

1. **The 6/10 PreProd PV11 hard fork and the ~6/15 mainnet go/no-go** — whether van Rossem's PreProd fork executes cleanly on 6/10 and whether the Hard Fork Working Group's mainnet go/no-go on ~6/15 returns a GO (with the HF governance action submitted 6/15-16), setting up a June–July mainnet enactment. SPO and tooling readiness (node v11.0.1, DB-Sync, Ogmios, Kupo) is the precondition; a clean PreProd fork is the rehearsal the mainnet go/no-go depends on.

2. **Whether the crypto correction finds a floor — or extends to a fifth week** — after four straight down weeks (BTC -16.5% / ADA -31% in W23 alone), whether Bitcoin-ETF flows turn, whether the broad complex stabilizes, and whether ADA's high-beta drawdown halts. The cleanest read on whether W23 was a capitulation low or a way-station.

3. **USDJPY 160 and possible Japanese FX intervention** — whether the yen's slide to 160 draws an official response, and how a defensive move would ripple through dollar liquidity and risk assets. The macro item with the broadest spillover into crypto.

4. **CLARITY's tax/banking negotiations and the 6/16–17 FOMC** — whether the CLARITY market-structure bill survives the tax and banking-access fight toward a Senate floor vote, and what the 6/16–17 FOMC (with SEP/dot-plot) signals about the path of policy in the Warsh era. The two regulatory/macro gates that frame June.

5. **Whether NIGHT's "attention" decoupling shows any first sign of "usage"** — whether Midnight publishes any City V2 / on-chain usage figures, how the developer-and-agent layer (Expert, MAIS, the Cardano↔Midnight bridge, Hilo teams) progresses, and whether NIGHT holds its separation from ADA into a fourth week. The Mōhalu phase (mid-2026) is the eventual conversion test; W24 is about whether the groundwork keeps compounding.

**W20 (the axis shift) → W21 (governance threshold, crypto unresponsive) → W22 (the first verdict, three clocks) → W23 (the widest price-vs-build gap)** — the **continued-verification phase of the "price does not reflect build" thesis** persists, now at its most extreme. Cardano spent its busiest build week inside its worst price week, and the only asset to confirm the build narrative in price was NIGHT — by holding the line rather than rallying. Verifying the medium-term thesis still hinges on whether the implementation density converts into usage data, and whether NIGHT's separation from ADA earns its backing from "attention" into "usage."

---

**Published by**: LiveMakers (SITION Group)
**SIPO**: DRep **#11** (voting power ~₳101.94M) · SPO ×3 · Midnight Ambassador
**Data sources**: Input Output official blog (iog.io) · Intersect MBO official · Cardano Foundation official · gov.tools / cgov.io / cardanoscan / Koios / adastat (reference) · CME official (cmegroup.com) · Indigo Protocol official · Liqwid Finance official · Token Terminal · DefiLlama · CoinGecko · Yahoo Finance · Financial Services Agency Japan · Federal Reserve official (federalreserve.gov) · Midnight Foundation / Midnight Network official · X official accounts (@IOGroup / @IntersectMBO / @Cardano_CF / @IOHK_Charles / @MidnightNtwrk / @midnight_jpn / @liqwidfinance, etc.) · secondary reporting (Bloomberg / CoinDesk / The Block / Axios and similar are explicitly marked "reported" in-text)

*This report is not investment advice. For institutional research purposes only.*
