/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LeadArticleCard } from "@/components/home/LeadArticleCard";
import { SeriesIndexCard } from "@/components/home/SeriesIndexCard";
import { SessionFocusChart } from "@/components/home/SessionFocusChart";
import { SessionNowCard } from "@/components/home/SessionNowCard";
import {
  buildFocusSeries,
  loadFocusSeriesRecords,
} from "@/lib/sessions/focus-series";
import { getSessionRecord } from "@/lib/sessions/session-content";

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

const provenance = {
  packetId: "sess_20260710_asia",
  sourceMode: "fixture_only" as const,
  reviewStatus: "reviewed_fixture" as const,
  asOfJst: "05:03 JST",
};
const provenanceLabels = {
  review: "審査状態",
  source: "ソース",
  asOf: "as-of",
  packet: "パケットID",
};

describe("lead group (ledger group 1)", () => {
  it("keeps bullets as text and only the full-session CTA navigates", () => {
    const record = getSessionRecord("2026-07-10-asia-open");
    render(
      <SessionNowCard
        record={record}
        provenance={provenance}
        copy={{
          sessionBadgeSuffix: "JST 更新",
          nextUpdateLine: "次の更新: Europe Bridge 12:03 JST",
          readFull: "セッション全文を読む →",
          provenance: provenanceLabels,
        }}
      />,
    );
    expect(screen.getByText("Asia Open Terminal")).toBeInTheDocument();
    const bullet = screen.getByText(/米CPI通過後、最初のアジア時間/);
    expect(bullet.closest("a")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: /セッション全文を読む/ })
        .getAttribute("href"),
    ).toContain("/sessions/2026-07-10-asia-open");
  });

  it("renders one sparkline and series packet per available focus instrument", () => {
    const series = ["nikkei_futures", "usd_jpy", "btc_usd"].map((id) =>
      buildFocusSeries(loadFocusSeriesRecords(), id as never, {
        windowEndJst: "2026-07-10T07:58:00+09:00",
      }),
    );
    const { container } = render(
      <SessionFocusChart
        sessionName="Asia Open Terminal"
        series={series}
        unavailableLabel="—"
        copy={{
          title: "セッション・フォーカス",
          snapshotBadge: "SNAPSHOT",
          description:
            "Asia Open Terminal の注目指標 · 直近24時間 · セッションの切り替わりで銘柄も入れ替わります",
          provenance: provenanceLabels,
        }}
      />,
    );
    expect(screen.getByText("セッション・フォーカス")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { hidden: true }).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/series\.2026-07-10\.nikkei_futures/),
    ).toBeInTheDocument();
    expect(screen.getByText("日経平均先物")).toBeInTheDocument();
    expect(screen.getByText("USD/JPY")).toBeInTheDocument();
    expect(screen.getByText("BTC/USD")).toBeInTheDocument();
    const labels = [
      ...container.querySelectorAll("[data-focus-instrument-label]"),
    ].map((element) => element.textContent ?? "");
    expect(labels).toEqual(["日経平均先物", "USD/JPY", "BTC/USD"]);
    expect(labels.some((label) => /[a-z]+_[a-z]+/.test(label))).toBe(false);
  });

  it("shows the pending article state without an empty link frame", () => {
    render(
      <LeadArticleCard
        slot={{ state: "pending", article: null, previous: null }}
        labels={{
          pending: "記事化待ち",
          pendingNote: "朝刊の公開準備中です",
          previous: "前回の記事を読む →",
          family: "Daily Intel",
        }}
      />,
    );
    expect(screen.getByText("記事化待ち")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("lists the eight series index links", () => {
    const { container } = render(
      <SeriesIndexCard
        copy={{
          title: "記事をたどる",
          subtitle: "シリーズ別の一覧",
          listLabel: "一覧 →",
          familyLabels: {
            "daily-intel": "Daily Intel",
            signal: "Signal",
            "deep-dive": "Deep Dive",
            "future-map": "次の時代の地図",
            "mkt12-morning": "朝の12指標",
            "mkt12-weekend": "週末の12指標",
            "event-risk-radar": "Event Risk Radar",
            "weekly-brief": "Weekly Brief",
          },
        }}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[0].getAttribute("href")).toContain(
      "/articles/series/daily-intel",
    );
    const card = container.querySelector("[data-index-nav]")!;
    const list = container.querySelector("[data-series-index-list]")!;
    expect(card.className).toContain("h-full");
    expect(list.children).toHaveLength(8);
    expect(list.className).not.toContain("grid-cols-2");
  });
});
