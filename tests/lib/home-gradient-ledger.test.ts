import { describe, expect, it } from "vitest";
import {
  GRADIENT_REGIONS,
  REGION_MODULES,
  INDEX_NAV_MODULES,
} from "@/lib/home/gradient-ledger";

describe("gradient ledger", () => {
  it("defines the three regions in DOM order", () => {
    // 2026-10-26 田平氏 GO (2 回目): スマホ専用の hero 領域を廃止 — スマホは
    // Intelligence Terminal (PC と同じ部品) を先頭に、その下に Daily Intel・12指標。
    expect(GRADIENT_REGIONS).toEqual(["leading", "coincident", "lagging"]);
  });
  it("defines module order per region (doctrine §4 gradient ledger)", () => {
    // 2026-08-14 Phase 3 (田平氏 GO): event-risk を schedule 直下・観測リストを
    // radar-observations として独立・mkt12-reading を lead-article 直下へ。
    // 2026-08-23 田平氏 GO: flash-promotion (昇格ペア) を撤去 — 公開以来一度も
    // ペアが成立しなかった空カード (spec 2026-08-23-terminal-switching-ux-design §D)。
    // 2026-10-09 田平氏 GO (案 A): radar-observations (観測リスト) を flash-list
    // (当日+前日の速報記事) へ置き換え — 同じ位置。
    // 2026-10-09 田平氏 GO: focus を末尾から schedule 直下へ (セッション →
    // 予定 → 注目銘柄チャートを連続させる)。
    // 2026-10-26 田平氏 GO: スマホ専用の Daily Intel 大カード・12指標 小カードを
    // focus の直下 (Intelligence Terminal の下) に置く。
    expect(REGION_MODULES.leading).toEqual([
      "session-now", "schedule", "focus", "lead-card-mobile", "mkt12-card-mobile",
      "event-risk", "flash-list",
    ]);
    // 2026-08-23 田平氏 GO B-1: lead-article + mkt12-reading を morning-desk
    // (「Daily Intel」帯) へ統合し、signal-timeline を前面化。
    // 2026-10-26 田平氏 GO: 8/22 の 2 枚 (lead-article + mkt12-reading) へ戻す。
    // 2026-10-28 田平氏 GO: 資金調達 (funding) を右の列から直近の Signal の直下へ。
    expect(REGION_MODULES.coincident).toEqual([
      "lead-article", "mkt12-reading", "signal-timeline", "funding", "mkt12-tiles",
      "lane-values",
    ]);
    // 2026-10-26 田平氏 GO: スマホでは Event Risk を「最新の記事」の直前に出す
    // (event-risk-mobile = スマホだけの表現・左の event-risk はスマホで非表示)。
    // 2026-10-29 田平氏 GO: 金融再起動の現在地 (restart-map) を記事の枠に加える (新着順に混ぜる)。
    expect(REGION_MODULES.lagging).toEqual([
      "deep-dive", "atlas-entry", "mkt12-weekend", "weekly-brief", "restart-map", "video", "event-risk-mobile",
      "latest-articles", "turning-point-reserved",
    ]);
  });
  it("marks index-nav modules (dedup-exempt)", () => {
    expect(INDEX_NAV_MODULES).toEqual([
      "lead-card-mobile", "mkt12-card-mobile",
      "flash-list", "event-risk-mobile",
      "atlas-entry", "mkt12-weekend", "weekly-brief", "restart-map", "funding", "latest-articles",
    ]);
  });
});
