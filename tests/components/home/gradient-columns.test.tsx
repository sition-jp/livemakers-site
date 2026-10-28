/* @vitest-environment jsdom */
import path from "node:path";

import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CoincidentColumn } from "@/components/home/columns/CoincidentColumn";
import { LaggingColumn } from "@/components/home/columns/LaggingColumn";
import { LeadingColumn } from "@/components/home/columns/LeadingColumn";
import { REGION_MODULES } from "@/lib/home/gradient-ledger";
import {
  orderLaggingModules,
  laggingModuleLatest,
} from "@/lib/home/lagging-order";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { buildTestHomeCopy } from "@/lib/home/home-copy";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const props = buildHomeCompositionProps({
  today: "2026-07-10",
  articleCutoffToday: "2026-07-10",
  contentDir: path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "content",
    "articles",
  ),
});
const copy = buildTestHomeCopy();

function renderLeading() {
  return render(
    <LeadingColumn
      live={props.live}
      schedule={props.schedule}
      slots={props.slots}
      focusSeries={props.focusSeries}
      focusSessionSlug={props.focusSessionSlug}
      sessionProvenance={props.sessionProvenance}
      copy={copy}
    />,
  );
}

describe("LeadingColumn (gradient leading, D5)", () => {
  it("labels the lane Intelligence Terminal without renaming the four sessions", () => {
    renderLeading();
    expect(
      screen.getByRole("heading", { name: "Intelligence Terminal" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Asia Open Terminal").length).toBeGreaterThan(0);
  });

  it("shows an honest session fallback with the next update line when degraded (P0-1b)", () => {
    const degraded = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-08-07",
      contentDir: path.join(
        process.cwd(),
        "tests",
        "fixtures",
        "content",
        "articles",
      ),
    });
    expect(degraded.live).toBeNull();
    const { container } = render(
      <LeadingColumn
        live={degraded.live}
        schedule={degraded.schedule}
        slots={degraded.slots}
        focusSeries={degraded.focusSeries}
        focusSessionSlug={degraded.focusSessionSlug}
        sessionProvenance={degraded.sessionProvenance}
        copy={copy}
      />,
    );
    // session-now カード (スマホも同じカード・2026-10-26)
    const sessionNow = within(
      container.querySelector('[data-column-module="session-now"]') as HTMLElement,
    );
    sessionNow.getByText("現在のセッションは切替中です");
    sessionNow.getByText("次の更新: Europe Bridge Terminal 12:03 JST");
  });

  it("renders modules in the ledger order", () => {
    const { container } = renderLeading();
    expect(
      [...container.querySelectorAll("[data-column-module]")].map((el) =>
        el.getAttribute("data-column-module"),
      ),
    ).toEqual([...REGION_MODULES.leading]);
  });

  it("splits event-risk (latest article) and flash-list (速報一覧) into two modules", () => {
    const { container } = renderLeading();
    // event-risk = 最新記事 1 本のみ (schedule 直下)
    const eventRisk = container.querySelector(
      '[data-column-module="event-risk"]',
    )!;
    expect(eventRisk.querySelector("[data-radar]")).toBeNull();
    const links = eventRisk.querySelectorAll("a[data-article-id]");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("data-article-id")).toBe(
      "event-risk-radar-w29",
    );
    // flash-list = 当日+前日の速報記事 (2026-10-09 田平氏 GO 案 A で観測
    // カードから置き換え)。fixture に該当速報は無いので速報一覧リンクのみ。
    expect(
      container.querySelector('[data-column-module="radar-observations"]'),
    ).toBeNull();
    const flashList = container.querySelector(
      '[data-column-module="flash-list"]',
    )!;
    expect(flashList.querySelector("[data-flash-list]")).not.toBeNull();
    expect(flashList.querySelector("[data-radar]")).toBeNull();
    expect(
      [...flashList.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href")),
    ).toEqual(["/articles/series/flash"]);
  });

  // 2026-08-23 田平氏 GO (spec §A): live が無く recentClosed がある → 終了カード。
  it("fills the switching gap with the most recent closed session (ended badge + link)", () => {
    const closed = {
      ...props.live!,
      liveStatus: "closed" as const,
      asOfJst: "2026-07-10T07:30:00+09:00",
    };
    const { container, getByText, queryByText } = render(
      <LeadingColumn
        live={null}
        recentClosed={closed}
        recentClosedProvenance={props.sessionProvenance}
        schedule={props.schedule}
        slots={props.slots}
        focusSeries={props.focusSeries}
        focusSessionSlug={props.focusSessionSlug}
        sessionProvenance={null}
        copy={copy}
      />,
    );
    expect(queryByText("現在のセッションは切替中です")).toBeNull();
    const card = container.querySelector('[data-column-module="session-now"] [data-session-state="closed"]');
    expect(card).not.toBeNull();
    getByText("SESSION · 05:03 JST 終了");
    getByText("次の更新: Europe Bridge Terminal 12:03 JST");
    expect(
      container.querySelector('[data-column-module="session-now"] a')?.getAttribute("href"),
    ).toBe("/sessions/2026-07-10-asia-open");
  });

  it("does not render a flash-promotion module (2026-08-23 撤去)", () => {
    const { container } = renderLeading();
    expect(container.querySelector('[data-column-module="flash-promotion"]')).toBeNull();
    expect(container.textContent).not.toContain("観測から記事へ");
  });
});

describe("CoincidentColumn (gradient coincident, D6)", () => {
  function renderCoincident() {
    return render(
      <CoincidentColumn
        slots={props.slots}
        snapshot={props.snapshot}
        coreCells={props.coreCells}
        laneCells={props.laneCells}
        laneProvenance={props.laneProvenance}
        alt20={props.alt20}
        mkt12Provenance={props.mkt12Provenance}
        copy={copy}
      />,
    );
  }

  it("renders modules in the ledger order", () => {
    const { container } = renderCoincident();
    expect(
      [...container.querySelectorAll("[data-column-module]")].map((el) =>
        el.getAttribute("data-column-module"),
      ),
    ).toEqual([...REGION_MODULES.coincident]);
  });

  // 2026-10-26 田平氏 GO: 8/23 の「Daily Intel」帯 (1 枚) をやめ、8/22 の形
  // (Daily Intel 欄 + 今朝の12指標欄の 2 枚・どちらも大きなサムネのカード) へ戻す
  it("renders Daily Intel and this morning's 12 indicators as two separate cards", () => {
    const { container } = renderCoincident();
    // Daily Intel 欄: full カード (family ラベル行あり) + 下に一覧リンク・<xl hidden (D8)
    const leadWrapper = container.querySelector('[data-column-module="lead-article"]')!;
    expect(leadWrapper.classList.contains("hidden")).toBe(true);
    expect(leadWrapper.classList.contains("xl:block")).toBe(true);
    const leadCard = leadWrapper.querySelector('a[data-lead-variant="full"]')!;
    expect(leadCard.getAttribute("data-article-id")).toBe("daily-intel-2026-07-10");
    expect(leadCard.querySelector("[data-article-thumbnail]")).not.toBeNull();
    const intelLink = leadWrapper.querySelector('a[href="/articles/series/daily-intel"]')!;
    expect(intelLink.closest("[data-index-nav]")).not.toBeNull();
    expect(leadCard.compareDocumentPosition(intelLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 今朝の12指標欄: 見出し + full カード (大きなサムネ) + 下にアーカイブリンク
    // 2026-10-26 田平氏 GO: スマホは左列のカード (mkt12-card-mobile) が担うので PC 専用
    const readingWrapper = container.querySelector('[data-column-module="mkt12-reading"]')!;
    expect(readingWrapper.classList.contains("hidden")).toBe(true);
    expect(readingWrapper.classList.contains("xl:block")).toBe(true);
    const reading = readingWrapper.querySelector("[data-mkt12-reading]")!;
    expect(reading.querySelector("h3")?.textContent).toBe(copy.mkt12.articleTitle);
    const card = reading.querySelector('[data-mkt12-role="hero"] a[data-article-id]')!;
    expect(card.getAttribute("data-article-id")).toBe("mkt12-morning-2026-07-10");
    expect(card.getAttribute("data-lead-variant")).toBe("full");
    expect(card.querySelector("[data-article-thumbnail]")).not.toBeNull();
    expect(card.textContent).toContain(copy.familyLabels["mkt12-morning"]);
    expect(reading.querySelector("[data-thumb-row]")).toBeNull();
    const archive = reading.querySelector('[data-mkt12-role="archive-link"]')!;
    expect(archive.querySelector('a[href="/articles/series/mkt12-morning"]')).not.toBeNull();
    expect(archive.hasAttribute("data-index-nav")).toBe(true);
    expect(card.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 右隣に並べない (8/23〜10/26 はスマホ幅で行が押し縮められた)
    expect(archive.parentElement).toBe(reading);
    expect(reading.classList.contains("flex-col")).toBe(true);

    // 8/23 の帯は残さない
    expect(container.querySelector("[data-morning-desk]")).toBeNull();
  });

  it("puts the signal timeline right after the 12 indicators card", () => {
    const { container } = renderCoincident();
    const modules = [...container.querySelectorAll("[data-column-module]")].map((el) =>
      el.getAttribute("data-column-module"),
    );
    expect(modules.slice(0, 3)).toEqual(["lead-article", "mkt12-reading", "signal-timeline"]);
  });

  it("renders the signal timeline with at least the floor of ten rows", () => {
    const { container } = renderCoincident();
    const timeline = container.querySelector(
      '[data-column-module="signal-timeline"]',
    )!;
    expect(
      timeline.querySelectorAll("a[data-article-id]").length,
    ).toBeGreaterThanOrEqual(10);
  });

  it("shows lane values with per-lane anchors and no article links", () => {
    const { container } = renderCoincident();
    const laneValues = container.querySelector(
      '[data-column-module="lane-values"]',
    )!;
    expect(laneValues.querySelectorAll("a")).toHaveLength(0);
    expect(
      [...laneValues.querySelectorAll("[data-lane]")].map((el) =>
        el.getAttribute("data-lane"),
      ),
    ).toEqual(["macro", "crypto", "rwa"]);
  });

  it("renders the alt20 grid in the crypto lane slot (— when alt20 is absent)", () => {
    const { container } = renderCoincident();
    const crypto = container.querySelector('[data-lane="crypto"]')!;
    expect(crypto.querySelectorAll('[data-testid="alt20-tile"]')).toHaveLength(0);
    expect(crypto.textContent).toContain("—");
    const withAlt = render(
      <CoincidentColumn
        slots={props.slots}
        snapshot={props.snapshot}
        coreCells={props.coreCells}
        laneCells={props.laneCells}
        laneProvenance={props.laneProvenance}
        alt20={{
          asOfJst: "2026-10-12T05:03:00+09:00",
          listVersion: "2026-10-11",
          items: [{ rank: 1, symbol: "BNB", changeLabel: "+0.10%", direction: "up" }],
          summary: { count: 1, up: 1, down: 0, flat: 0, medianChangeLabel: "+0.10%" },
        }}
        mkt12Provenance={props.mkt12Provenance}
        copy={copy}
      />,
    );
    const lane = withAlt.container.querySelector('[data-lane="crypto"]')!;
    expect(lane.querySelectorAll('[data-testid="alt20-tile"]')).toHaveLength(1);
  });

  it("does not render the retired pair-section joint glyph", () => {
    const { container } = renderCoincident();
    expect(container.textContent).not.toContain("⇄");
  });
  // 2026-10-28 田平氏 GO: 資金調達の棚は直近の Signal の直下。0 本の本番では空の枠を
  // 隠す (列の space-y-6 の余白を取らない)・data-column-module は残す (台帳順の突合)
  it("places the funding shelf right after the signal timeline", () => {
    const fundingArticles = props.slots.latestArticles.slice(0, 1);
    expect(fundingArticles).toHaveLength(1);
    const { container } = render(
      <CoincidentColumn
        slots={{ ...props.slots, fundingArticles }}
        snapshot={props.snapshot}
        coreCells={props.coreCells}
        laneCells={props.laneCells}
        laneProvenance={props.laneProvenance}
        alt20={props.alt20}
        mkt12Provenance={props.mkt12Provenance}
        copy={copy}
      />,
    );
    const funding = container.querySelector('[data-column-module="funding"]')!;
    expect(
      funding.previousElementSibling?.getAttribute("data-column-module"),
    ).toBe("signal-timeline");
    expect(funding.hasAttribute("hidden")).toBe(false);
    expect(funding.hasAttribute("aria-hidden")).toBe(false);
    expect(funding.querySelector('a[href="/topics/funding"]')).not.toBeNull();
  });

  it("hides the empty funding wrapper when there are no funding articles", () => {
    const { container } = render(
      <CoincidentColumn
        slots={{ ...props.slots, fundingArticles: [] }}
        snapshot={props.snapshot}
        coreCells={props.coreCells}
        laneCells={props.laneCells}
        laneProvenance={props.laneProvenance}
        alt20={props.alt20}
        mkt12Provenance={props.mkt12Provenance}
        copy={copy}
      />,
    );
    const funding = container.querySelector('[data-column-module="funding"]')!;
    expect(funding).not.toBeNull();
    expect(funding.hasAttribute("hidden")).toBe(true);
    expect(funding.getAttribute("aria-hidden")).toBe("true");
    expect(funding.childElementCount).toBe(0);
  });

  it("keeps the lagging column free of the funding shelf", () => {
    expect(REGION_MODULES.lagging).not.toContain("funding");
  });
});

describe("LaggingColumn (gradient lagging, D7)", () => {
  function renderLagging(surfacePublished = false) {
    return render(
      <LaggingColumn
        slots={props.slots}
        surfacePublished={surfacePublished}
        copy={copy}
      />,
    );
  }

  it("renders the four article modules newest-first, then the fixed ledger tail (2026-08-23 田平氏 GO A)", () => {
    const { container } = renderLagging();
    const rendered = [
      ...container.querySelectorAll("[data-column-module]"),
    ].map((el) => el.getAttribute("data-column-module"));
    expect(rendered).toEqual(orderLaggingModules(props.slots));
    // permutation of the ledger — nothing added, nothing dropped
    expect([...rendered].sort()).toEqual([...REGION_MODULES.lagging].sort());
    expect(rendered.slice(-2)).toEqual([
      "latest-articles",
      "turning-point-reserved",
    ]);
    // the article block really is in publishedAtJst descending order
    const stamps = rendered
      .slice(0, 4)
      .map(
        (module) =>
          laggingModuleLatest(
            props.slots,
            module as "deep-dive" | "atlas-entry" | "mkt12-weekend" | "weekly-brief",
          )?.publishedAtJst ?? "",
      )
      .filter((stamp) => stamp !== "");
    expect(stamps).toEqual([...stamps].sort().reverse());
    expect(
      container
        .querySelector('[data-ledger-group="lagging"]')!
        .getAttribute("data-lagging-order"),
    ).toBe("newest-first");
  });

  it("moves a module to the top when its latest article is the newest", () => {
    const newest = {
      ...props.slots.latestArticles[0]!,
      articleId: "weekly-brief-newest",
      family: "weekly-brief" as const,
      publishedAtJst: "2026-07-10T23:00:00+09:00",
      href: "/articles/weekly-brief-newest",
    };
    const { container } = render(
      <LaggingColumn
        slots={{ ...props.slots, weeklyBriefLatest: newest }}
        surfacePublished={false}
        copy={copy}
      />,
    );
    const rendered = [
      ...container.querySelectorAll("[data-column-module]"),
    ].map((el) => el.getAttribute("data-column-module"));
    expect(rendered[0]).toBe("weekly-brief");
    expect(rendered.slice(-2)).toEqual([
      "latest-articles",
      "turning-point-reserved",
    ]);
  });

  it("treats only the deep-dive featured article as body content", () => {
    const { container } = renderLagging();
    const deepDive = container.querySelector(
      '[data-column-module="deep-dive"]',
    )!;
    const bodyLinks = [
      ...deepDive.querySelectorAll("a[data-article-id]"),
    ].filter((a) => a.closest("[data-index-nav]") === null);
    expect(bodyLinks).toHaveLength(1);
  });

  it("keeps every link in the index modules under data-index-nav", () => {
    const { container } = renderLagging();
    for (const module of [
      "atlas-entry",
      "mkt12-weekend",
      "weekly-brief",
      "latest-articles",
    ]) {
      const el = container.querySelector(`[data-column-module="${module}"]`)!;
      for (const anchor of el.querySelectorAll("a")) {
        expect(anchor.closest("[data-index-nav]")).not.toBeNull();
      }
    }
  });

  it("points the atlas entry at the future-map series while unpublished", () => {
    const { container } = renderLagging(false);
    const atlas = container.querySelector(
      '[data-column-module="atlas-entry"]',
    )!;
    expect(
      atlas.querySelector('a[href="/articles/series/future-map"]'),
    ).not.toBeNull();
  });

  it("switches the atlas entry to /future-atlas when published", () => {
    const { container } = renderLagging(true);
    const atlas = container.querySelector(
      '[data-column-module="atlas-entry"]',
    )!;
    expect(atlas.querySelector('a[href="/future-atlas"]')).not.toBeNull();
  });

  it("renders latest-articles as twenty index-nav rows (2026-08-14 田平氏指示)", () => {
    const { container } = renderLagging();
    const latest = container.querySelector(
      '[data-column-module="latest-articles"]',
    )!;
    expect(latest.querySelectorAll("a[data-article-id]")).toHaveLength(20);
  });
});
