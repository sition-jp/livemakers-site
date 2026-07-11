/* @vitest-environment jsdom */
import path from "node:path";

import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LaneBlock } from "@/components/home/LaneBlock";
import { LibraryShelf } from "@/components/home/LibraryShelf";
import { getArticleBySlug } from "@/lib/articles/article-model";
import { LANE_ROWS } from "@/lib/home/instruments";

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
  packetId: "lmk_20260710_0758_fx01",
  sourceMode: "fixture_only" as const,
  reviewStatus: "reviewed_fixture" as const,
  asOfJst: "07:58 JST",
};
const TEST_CONTENT_DIR = path.join(process.cwd(), "tests", "fixtures", "content", "articles");
const testOptions = { contentDir: TEST_CONTENT_DIR };
const copy = {
  provenance: {
    review: "審査状態",
    source: "ソース",
    asOf: "as-of",
    packet: "パケットID",
  },
  familyLabels: {
    "daily-intel": "Daily Intel",
    signal: "Signal",
    "deep-dive": "Deep Dive",
    "future-map": "次の時代の地図",
    "mkt12-morning": "朝の12指標",
    "mkt12-weekend": "週末の12指標",
    "event-risk-radar": "Event Risk Radar",
    "weekly-brief": "Weekly Brief",
    session: "セッション記事",
  },
};

describe("lane + library (ledger groups 4-6, 8)", () => {
  it("renders complement rows and at most two articles without an empty frame", () => {
    const values = LANE_ROWS.macro.map((row, index) => ({
      ...row,
      value: ["26,206.89", "52,487.41", "$76.00"][index],
      changeLabel: ["+1.30%", "+0.27%", "-2.59%"][index],
      up: [true, true, false][index],
    }));
    const { rerender } = render(
      <LaneBlock
        lane="macro"
        title="MACRO"
        subtitle="12指標の補完データ"
        rows={values}
        articles={[
          getArticleBySlug("event-risk-radar-w29", testOptions),
          getArticleBySlug("signal-dxy-plateau-2026-07-09", testOptions),
        ]}
        asOfLabel="07:58 JST"
        provenance={provenance}
        copy={copy}
      />,
    );
    expect(screen.getByText("NASDAQ総合")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);

    rerender(
      <LaneBlock
        lane="rwa"
        title="RWA"
        subtitle=""
        rows={values}
        articles={[]}
        asOfLabel="07:58 JST"
        provenance={provenance}
        copy={copy}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("appends the fixed session archive index card", () => {
    render(
      <LibraryShelf
        articles={[getArticleBySlug("deep-dive-midnight-economy", testOptions)]}
        copy={{
          familyLabels: copy.familyLabels,
          archiveTitle: "セッション記事アーカイブ — 朝昼夕夜の全記録",
          archiveNote: "1日4回、ライブは時間が経つと記事になります",
        }}
      />,
    );
    expect(
      screen
        .getByRole("link", {
          name: /セッション記事アーカイブ — 朝昼夕夜の全記録/,
        })
        .getAttribute("href"),
    ).toContain("/sessions/archive");
    expect(
      screen.getByText(/1日4回、ライブは時間が経つと記事になります/),
    ).toBeInTheDocument();
  });
});
