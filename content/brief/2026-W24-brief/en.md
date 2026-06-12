# LiveMakers Weekly Brief — W24 / Jun 7 - Jun 13 2026

**The Audit Gate — Cardano's 2026 Budget Vote Closes as Risk Assets Bounce, but Execution Moves to Verification**

**Published**: 2026-06-13 JST · **Epoch**: 636 (635→636 transition 2026-06-09) · **Issue #10**

---

## Executive Summary

W24 is best read as **the audit-gate week**. The market recovered from W23's violent crypto sell-off, but Cardano's most important development was not price. It was process: the 2026 budget voting phase closed on the Hydra Voting platform with **more than 5B ADA of voting power, roughly 85% of active DRep stake, and 100+ DReps participating**. That is a major legitimacy signal for Voltaire. It is also not a final budget verdict. The correct next step is the independent audit window scheduled for **2026-06-15 to 2026-06-19**, followed by integration and preparation for on-chain submission.

The tape improved, but it did not become clean risk-on. From the W23 reference snapshot to W24, **BTC rose +3.5%, ETH +5.1%, and ADA +6.6%**, while ADA's 24h change at the W24 capture was +6.84%. Yet the S&P 500 fell -2.5% week-over-week, the VIX rose from 15.4 to 19.44, USDJPY stayed near 160, and oil reversed lower as the Iran story moved from headline agreement to condition verification. Crypto bounced; macro risk was still live.

Under the price action, Cardano's execution layer kept moving. The IOR proposal for the Cardano Vision 2026 was ratified with a **74.96% confidence vote**. Essential Cardano's 2026-06-12 development report highlighted a beta property-based testing tool from High Assurance and Mithril work on a **SNARK-friendly genesis certificate**, DMQ support, and Cardano-node ledger-state certification. The Constitutional Committee election also became a live governance watch: four seats become vacant in September, only four candidates were registered in the report window, and the candidate deadline is **2026-06-21**.

Regulation was constructive but unfinished. Senator Lummis framed CLARITY as the work of turning existing rules into law, while Japan's FSA published the promulgation and public-comment result for amendments to bank-law cabinet-office ordinances. These are rails, not a price catalyst. Midnight, meanwhile, shifted from W23's developer-and-agent layer toward community expansion: Japan's Nightforce Cohort 5 opened, while NIGHT bounced 24h but remained lower week-over-week versus W23's reference price. The honest reading is the same as before: attention is present, usage proof is still the conversion test.

The W24 conclusion is therefore narrower and more useful than "risk-on returned." **The market recovered enough to stop the W23 panic, but the investment clock moved to verification.** Next week has two hard gates: the budget audit window and the 2026-06-16/17 FOMC. For Cardano, the watch is whether a high-participation off-chain vote becomes a clean audited package ready for on-chain governance. For markets, the watch is whether a crypto bounce can survive VIX near 20, USDJPY near 160, and unresolved geopolitical conditions.


---

## 1. Market Pulse — A Crypto Bounce Inside an Unresolved Macro Tape

### Week-over-Week (W23 reference snapshot → W24 reference snapshot)

> **Reference timestamps**: W23 reference = 2026-06-06 (~07:15 JST capture) / W24 reference = 2026-06-13 JST morning capture, using 2026-06-12 market data and the last NY close prior to publication. Crypto is spot at the reference capture; traditional markets are the last NY close. The key methodological note is that W24 compares against the published W23 brief, because that is the live reader-facing baseline.

| Asset | W23 ref | W24 ref | W-o-W Δ | Note |
|---|---:|---:|---:|---|
| BTC | $61,305 | $63,471 | **+3.5%** | Recovered part of W23's sharp sell-off |
| ETH | $1,594.3 | $1,676.2 | **+5.1%** | Beta rebound, still below earlier-cycle levels |
| ADA | $0.16011 | $0.17073 | **+6.6%** | 24h +6.84% at capture; higher-beta bounce |
| **NIGHT** | ~$0.0351 | **$0.0329** | **-6.2%** | 24h +6.78%, but lower W-o-W; usage proof still pending |
| SOL | $64.25 | $66.90 | **+4.1%** | Rebounded with majors |
| XRP | $1.10 | $1.14 | **+3.6%** | Steady rebound |
| ALGO | $0.09384 | $0.08918 | **-5.0%** | Did not fully join the bounce |
| DOT | $0.95089 | $0.95853 | **+0.8%** | Nearly flat |
| ATOM | $1.66 | $2.02 | **+21.7%** | Strongest rebound in the tracked group |
| ICP | $2.32 | $2.28 | **-1.7%** | Still soft |
| FET | $0.19812 | $0.19314 | **-2.5%** | AI-token bid still uneven |
| WLFI | $0.05709 | $0.05928 | **+3.8%** | Modest recovery |
| WTI | $92.83 | $85.97 | **-7.4%** | Fell as Iran moved to condition verification |
| Brent | $95.20 | $88.57 | **-7.0%** | Same oil-risk reversal |
| Gold | $4,503.3 | $4,237.5 | **-5.9%** | Safe-haven bid cooled |
| DXY | 99.432 | 99.675 | **+0.24%** | Dollar still firm |
| VIX | 15.4 | 19.44 | **+26.2%** | Lower 24h, but materially higher W-o-W |
| **SPX** | 7,584.3 | 7,394.3 | **-2.5%** | Equity tape no longer record-clean |
| Nasdaq Comp | 26,831.0 | 25,809.7 | **-3.8%** | Growth equities softened |
| DJI | 51,561.9 | 50,848.8 | **-1.4%** | Off W23's record close |
| Nikkei | 67,570 | 66,650 | **-1.4%** | Still elevated, but lower W-o-W |
| US 10Y | 4.477% | 4.463% | **-1.4 bp** | Little changed |
| **USDJPY** | 159.998 | 160.076 | **+0.05%** | Still around the 160 line |
| COIN | $164.13 | $160.43 | **-2.3%** | Crypto equity lagged the spot bounce |

### The bounce was real, but the risk regime did not reset

The difference from W23 is obvious: crypto stopped falling in a straight line. BTC, ETH, ADA, SOL and XRP all recovered, and the W24 capture showed strong 24h moves across the complex. ADA's +6.6% W-o-W move is meaningful because it came after the prior week's -31% drawdown; it tells us that W23's sell-off was not still accelerating at the reference point.

But it would be too easy to call this a clean risk-on week. The equity tape deteriorated from W23's record-clean posture: SPX -2.5%, Nasdaq Composite -3.8%, DJI -1.4%, VIX +26% W-o-W. USDJPY remained around 160, the line that W23 already identified as a potential macro trigger. Oil fell sharply as the Iran story shifted from market-moving agreement headlines to condition verification and counter-messaging. That combination creates a more subtle regime: **crypto bounced, but the macro backdrop moved from calm divergence to unresolved verification.**

The useful investment distinction is therefore between **price repair** and **regime repair**. W24 gave us price repair. It did not yet give us regime repair. For that, we would need lower sustained volatility, a cleaner USDJPY setup, more settled Middle East/oil conditions, and next week's FOMC to avoid tightening the liquidity narrative.

---

## 2. Governance Update — The 2026 Budget Vote Closed; the Result Has Not Been Finalized

### The headline number is participation

The most important Cardano event in W24 was the closure of the 2026 budget voting phase on the Hydra Voting platform. Intersect reported **more than 5B ADA of voting power**, **roughly 85% of active DRep stake**, and **100+ participating DReps**. Participation exceeded the 2025 budget-cycle comparison cited in the local research queue, making this a legitimacy milestone for Voltaire's off-chain coordination machinery.

That is the positive read. The precise read is just as important: **voting complete does not mean budget result finalized.** The process now moves to the independent audit window scheduled for **2026-06-15 to 2026-06-19**. After audit, the package must be integrated and prepared for on-chain submission. The right headline is therefore "audit next," not "budget passed" or "budget failed."

This distinction matters because Voltaire's credibility depends on the chain showing that high-participation governance can also be reproducible, auditable and cleanly mapped into on-chain action. W23 taught the market that "majority support" is not the same as "funds released" in the Summit vote. W24 teaches the adjacent lesson: **off-chain vote completion is not the same as audited on-chain readiness.**

### IOR / Cardano Vision 2026 was ratified

In research governance, the IOR proposal for Cardano Vision 2026 was ratified with a **74.96% confidence vote**. This gives the Vision 2026 work a stronger mandate than a loose strategy memo. The more important reading is that it aligns Cardano's research layer with the budget and implementation debates happening elsewhere: vision, funding, testing and governance are now all moving through formal checks rather than informal applause.

### Constitutional Committee candidate supply is the next governance bottleneck

Essential Cardano's 2026-06-12 report highlighted a quieter but important governance issue: four Constitutional Committee seats become vacant in September, only four candidates were registered in the report window, and the candidate deadline is **2026-06-21**. This is not a crisis, but it is a bottleneck. A mature governance system needs competitive candidate supply, not merely enough candidates to fill seats.

For DReps and SPOs, this creates a practical watch item for W25: whether more qualified candidates step forward before the deadline, and whether the election becomes a genuine choice rather than a capacity patch.

---

## 3. Build Layer — High Assurance and Mithril Move the Quiet Critical Path

W24 did not have a single consumer-facing Cardano product headline equivalent to W23's CME/Indigo cluster. Instead, the critical path moved deeper into the assurance and infrastructure layer.

### High Assurance: property-based testing reaches beta

The High Assurance team finalized the beta version of a property-based testing tool for internal testing. The report specifically points to the testing interface, positive and negative testing, threat models, coverage work, VS Code extension work and AI-skill experimentation. This is not glamorous. It is exactly the kind of unglamorous work that matters when a network is trying to move from fast iteration to durable public infrastructure.

Property-based testing is especially important for protocol work because it shifts testing from "did this example pass" toward "does this property hold across a large space of generated cases." For a governance-heavy, hard-fork-capable public chain, that kind of discipline is not optional plumbing; it is part of how protocol changes earn trust.

### Mithril: SNARK-friendly genesis and DMQ support

Mithril's line in the 2026-06-12 report is also strategically important. The team completed implementation of a **SNARK-friendly genesis certificate**, continued refactoring for SNARK recursive circuits, worked on prover input and SNARK proof verification, completed DMQ ledger peer support, enforced DMQ message ID formats, and prototyped Cardano-node ledger-state certification.

The short version: Mithril is still moving toward a world where Cardano state can be certified, compressed, verified and consumed by lighter clients and adjacent systems with stronger proof guarantees. That is a prerequisite for better wallets, bridges, rollup-style integrations, and cross-domain infrastructure. It is also exactly the type of progress that rarely moves price in the week it ships.

### The architecture risk reading stays low

Because the W24 build news is assurance-heavy, the architecture risk reading stays **LOW →** rather than falling dramatically. The direction is forward, but the proof is in integration. The watch is whether the High Assurance beta feeds practical review workflows, whether Mithril's SNARK/DMQ work lands in production paths, and whether these pieces reduce operational risk rather than simply adding impressive nouns to the roadmap.

---

## 4. Macro / Regulation — CLARITY, Japan FSA, Iran Conditions, and the 160 Yen Line

### CLARITY: constructive framing, not enactment

Senator Lummis's W24 messaging framed CLARITY as the work of turning existing rules into law while protecting developers, investors and market integrity. That is constructive for the market-structure narrative. It does not mean CLARITY is enacted. The useful read is that Washington's crypto debate continues to move from "whether rules are needed" to "which rules become statutory and how they divide agency authority."

For Cardano, the relevance is not immediate price. It is institutional legibility. A clearer US perimeter would help regulated products, custody, developer liability analysis and exchange listings. W24 added momentum to that frame; it did not close the file.

### Japan FSA: bank-rule amendments enter the official record

On 2026-06-12, Japan's Financial Services Agency published the promulgation and public-comment result for amendments to Cabinet Office Orders including the Banking Act Enforcement Regulation. This sits in the same broad post-enforcement environment as W23's Japan regulation discussion, but it should not be overread as a new crypto-specific catalyst by itself.

The Japan takeaway is more operational: financial rails continue to be clarified through official public-comment and ordinance processes. For a market where stablecoins, bank access, custody, cards and payment intermediaries all matter, the slow official record is part of the adoption surface.

### Iran: condition verification, not a completed deal

W24's oil move is best understood through the correction in the Iran narrative. Earlier agreement headlines moved the market, but the follow-up story became condition verification: what exactly was written, what was agreed, whether the Strait/oil/shipping-insurance conditions change, and whether officials confirm the same terms. WTI -7.4% and Brent -7.0% W-o-W show that energy risk repriced lower, but not that geopolitical risk disappeared.

This is why W24 is not a clean risk-on week. Crypto bounced while oil fell and VIX remained higher W-o-W. Those can coexist, but they do not constitute an all-clear.

### USDJPY 160 and FOMC remain next week's macro gates

USDJPY stayed around 160, barely changed from W23. That is the same psychological and policy-sensitive line W23 identified. The next FOMC on **2026-06-16/17** adds a second gate: if the Fed messaging pushes yields/dollar conditions tighter, the crypto bounce faces a tougher liquidity test. If it lands softer, W24's rebound has more room to become regime repair.

---

## 5. Midnight Watch — Contributor Expansion, but Usage Proof Still Decides

Midnight's W24 note is narrower than W23's developer-and-agent layer, but still useful: **Nightforce Cohort 5 opened in Japan**. That matters because Midnight needs not only core protocol progress but a repeated contributor funnel: ambassadors, educators, developers, local community operators, and eventually application teams.

NIGHT's price action gives a balanced read. It bounced +6.78% over 24h at the W24 capture, but versus the W23 reference it was down roughly -6.2%. That is neither a failure nor a confirmation. It simply means the W23 claim remains the right one: NIGHT has attention and a separate narrative, but usage proof is still the conversion test.

The watch for W25 is unchanged: any credible City V2 or on-chain usage data, any measurable growth in developer activity, any bridge or DUST capacity milestone, and whether Japan's contributor funnel translates into visible output rather than only community motion.

---

## 6. Risk Dimensions

| Dimension | W23 | W24 | Trend | Key drivers |
|---|---|---|---|---|
| **Overall** | MEDIUM ↗ | **MEDIUM →** | panic eased, verification risk remains | Crypto bounced, but VIX higher W-o-W, USDJPY 160, FOMC/audit gates next |
| **Macro** | MEDIUM ↗ | **MEDIUM →** | mixed | SPX/Nasdaq lower W-o-W, VIX 19.44, oil down on Iran-condition verification, USDJPY near 160 |
| **Regulatory** | LOW → | **LOW →** | constructive but unfinished | CLARITY messaging advanced; Japan FSA bank-rule amendment record published |
| **Architecture** | LOW → | **LOW →** | forward | High Assurance beta testing tool; Mithril SNARK-friendly genesis certificate and DMQ support |
| **Adoption** | LOW → | **LOW →** | awaiting proof | Midnight Nightforce funnel expands; no new usage proof; TVL unchanged in this capture |
| **Governance** | MEDIUM → | **MEDIUM →** | high participation, audit pending | Budget voting phase complete with strong participation; independent audit still ahead |

### Dimension reads

**Overall MEDIUM →**: W23's panic did not continue, which is constructive. But W24 is not an all-clear. The risk moved from acute sell-off to verification: budget audit, FOMC, Iran terms, USDJPY 160, and a VIX still materially above W23.

**Macro MEDIUM →**: The macro tape is mixed. Crypto rebounded, equities softened, oil fell, and the dollar/yen line stayed sensitive. A cleaner macro downshift would require VIX to normalize and the FOMC to avoid tightening the dollar-liquidity story.

**Regulatory LOW →**: CLARITY and FSA developments both point in a constructive direction, but neither is a completed market-structure endpoint. The risk is low because the direction is clarification rather than restriction; it remains flat because the work is unfinished.

**Architecture LOW →**: High Assurance and Mithril are exactly the kind of work that lowers long-term protocol risk, but only after integration. W24 keeps the architecture dimension low and forward.

**Adoption LOW →**: Contributor funnels and market rails are improving, but usage data remains the missing proof. Midnight's Nightforce Cohort 5 helps the funnel; it does not replace on-chain metrics.

**Governance MEDIUM →**: Participation was strong enough to be a legitimacy milestone, but the audit is the next trust gate. Governance risk does not fall until the vote package survives audit and is cleanly prepared for on-chain submission.

---

## 7. Next Week Preview

Five watch items for W25 / Jun 14 - Jun 20:

1. **2026 budget audit window (2026-06-15 to 2026-06-19)** — whether the high-participation Hydra Voting result survives independent audit cleanly, and how quickly the integrated package is prepared for on-chain submission.

2. **FOMC / SEP on 2026-06-16/17** — whether Fed messaging and the dot plot support W24's crypto rebound or re-tighten the dollar/yields backdrop.

3. **Constitutional Committee candidate deadline (2026-06-21)** — whether more candidates register before the deadline and turn the September seat refresh into a competitive governance process.

4. **USDJPY 160 and Japan policy sensitivity** — whether the yen line remains a live intervention/liquidity trigger.

5. **Midnight usage evidence** — whether Nightforce/community expansion is joined by concrete application, bridge, City V2, DUST or on-chain usage data.

**W20 (axis shift) → W21 (governance threshold) → W22 (first verdict) → W23 (widest price-vs-build gap) → W24 (audit gate)**. The thesis evolved from divergence to verification. Cardano now needs to show that participation can become audited governance, and markets need to show that a rebound can survive macro conditions that are still unresolved.

---

**Published by**: LiveMakers (SITION Group)  
**SIPO**: DRep **#11** (voting power ~₳101.94M) · SPO ×3 · Midnight Ambassador  
**Data sources**: Intersect MBO official / Hydra Voting · Essential Cardano development report (2026-06-12) · IO Research / Cardano Vision 2026 · Financial Services Agency Japan · Senator Lummis official communications · Midnight Japan · SITION market indicators / FRED / Yahoo Finance captures · prior LiveMakers W23 reference snapshot

*This report is not investment advice. For institutional research purposes only.*
