import { describe, expect, it } from "vitest";
import {
  GRADIENT_REGIONS,
  REGION_MODULES,
  INDEX_NAV_MODULES,
} from "@/lib/home/gradient-ledger";

describe("gradient ledger", () => {
  it("defines the four regions in DOM order", () => {
    expect(GRADIENT_REGIONS).toEqual(["hero", "leading", "coincident", "lagging"]);
  });
  it("defines module order per region (doctrine §4 gradient ledger)", () => {
    // 2026-10-26 田平氏 GO (スマホの並び): hero = Daily Intel 大カード + 12指標 小カード。
    // セッション 1 行は Intelligence Terminal の見出しの下 (leading の先頭) へ移す。
    expect(REGION_MODULES.hero).toEqual(["hero-lead-card", "hero-mkt12-card"]);
    // 2026-08-14 Phase 3 (田平氏 GO): event-risk を schedule 直下・観測リストを
    // radar-observations として独立・mkt12-reading を lead-article 直下へ。
    // 2026-08-23 田平氏 GO: flash-promotion (昇格ペア) を撤去 — 公開以来一度も
    // ペアが成立しなかった空カード (spec 2026-08-23-terminal-switching-ux-design §D)。
    // 2026-10-09 田平氏 GO (案 A): radar-observations (観測リスト) を flash-list
    // (当日+前日の速報記事) へ置き換え — 同じ位置。
    // 2026-10-09 田平氏 GO: focus を末尾から schedule 直下へ (セッション →
    // 予定 → 注目銘柄チャートを連続させる)。
    expect(REGION_MODULES.leading).toEqual([
      "session-line", "session-now", "schedule", "focus", "event-risk", "flash-list",
    ]);
    // 2026-08-23 田平氏 GO B-1: lead-article + mkt12-reading を morning-desk
    // (「Daily Intel」帯) へ統合し、signal-timeline を前面化。
    // 2026-10-26 田平氏 GO: 8/22 の 2 枚 (lead-article + mkt12-reading) へ戻す。
    expect(REGION_MODULES.coincident).toEqual([
      "lead-article", "mkt12-reading", "signal-timeline", "mkt12-tiles", "lane-values",
    ]);
    // 2026-10-26 田平氏 GO: スマホでは Event Risk を「最新の記事」の直前に出す
    // (event-risk-mobile = スマホだけの表現・左の event-risk はスマホで非表示)。
    expect(REGION_MODULES.lagging).toEqual([
      "deep-dive", "atlas-entry", "mkt12-weekend", "weekly-brief", "event-risk-mobile",
      "latest-articles", "turning-point-reserved",
    ]);
  });
  it("marks index-nav modules (dedup-exempt)", () => {
    expect(INDEX_NAV_MODULES).toEqual([
      "hero-lead-card", "hero-mkt12-card", "session-line",
      "flash-list", "event-risk-mobile",
      "atlas-entry", "mkt12-weekend", "weekly-brief", "latest-articles",
    ]);
  });
});
