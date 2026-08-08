/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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

import { SessionNowCard } from "@/components/home/SessionNowCard";
import type { SessionRecord } from "@/lib/sessions/session-content";

const record: SessionRecord = {
  sessionId: "2026-07-10-asia-open",
  date: "2026-07-10",
  sessionSlug: "asia-open",
  liveStatus: "live",
  articleStatus: "pending",
  currentUrl: "/sessions/2026-07-10-asia-open",
  canonicalArticleUrl: null,
  publishedAt: null,
  publishLogId: null,
  packetId: "sess_20260710_asia",
  asOfJst: "2026-07-10T05:03:00+09:00",
  focusInstruments: ["nikkei_futures", "usd_jpy"],
  titleJa: "Asia Open Terminal",
  bullets: [
    "米CPI通過後、最初のアジア時間。円と日経先物の初動が焦点",
    "BTCは63K台で続伸。アジア時間の現物フローは薄く、方向感は米時間持ち越し",
  ],
  focusFallbackApplied: false,
  bodyJa: null,
  // Explicit repo-origin marker (fix round 2 / I-2) — this fixture represents
  // a session already crystallized to content/sessions/, matching what
  // getAllSessionRecords() would return, distinct from the feed-lifted,
  // not-yet-materialized fixture used below.
  hasMaterializedRoute: true,
};

const editorial = {
  digestId: "dig_20260710_0712_ab12cd34",
  crawlAnchorJst: "2026-07-10T05:03:00+09:00",
  writtenAtJst: "2026-07-10T07:12:00+09:00",
  lead: "市場は政策発言を受けて方向感を探っている。一次情報では次の判断材料が示された。三文目はカードに出さない。",
  items: [
    {
      headline: "一次情報で確認された主要な動き",
      note: "発表主体は次の対応方針を示した。",
      sourceUrl: "https://primary.example.org/news/123",
    },
    {
      headline: "二つ目の確認事項",
      sourceUrl: "https://primary.example.org/news/456",
    },
  ],
  watch: ["次の公式発表を確認する。"],
};

const copy = {
  sessionBadgeSuffix: "JST 更新",
  freshnessPrefix: "スナップショット",
  nextUpdateLine: "次の更新: Europe Bridge Terminal 12:03 JST",
  readFull: "セッション全文を読む →",
  editorialPrefix: "インテリジェンス",
  editorialSuffix: "本 →",
  provenance: {
    review: "審査状態",
    source: "ソース",
    asOf: "as-of",
    packet: "パケットID",
  },
};
const provenance = {
  packetId: "sess_20260710_asia",
  sourceMode: "fixture_only" as const,
  reviewStatus: "reviewed_fixture" as const,
  asOfJst: "05:03 JST",
};

describe("SessionNowCard", () => {
  it("promotes bullets[0] to the headline and keeps nameEn + registry nameJa", () => {
    render(
      <SessionNowCard record={record} provenance={provenance} copy={copy} />,
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain(
      "米CPI通過後、最初のアジア時間",
    );
    expect(screen.getByText("Asia Open Terminal")).toBeInTheDocument();
    expect(
      screen.getByText("朝 · 日本/アジア向け始動マップ"),
    ).toBeInTheDocument();
  });

  it("shows a dated snapshot freshness line and never a live-now token", () => {
    const { container } = render(
      <SessionNowCard record={record} provenance={provenance} copy={copy} />,
    );
    // スナップショット と 2026-07-10 はそれぞれ鮮度行のみに現れる一意テキスト。
    expect(screen.getByText(/スナップショット/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-10/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("更新中");
    expect(container.textContent).not.toMatch(/\bLIVE\b/);
  });
});

describe("SessionNowCard D6 link routing (crystallize 前の 404 回避, G43-e / fix round 2 I-2)", () => {
  it("routes the full-session CTA to currentUrl for a repo-origin pending session (②)", () => {
    expect(record.articleStatus).toBe("pending");
    expect(record.hasMaterializedRoute).toBe(true);
    render(
      <SessionNowCard record={record} provenance={provenance} copy={copy} />,
    );
    expect(
      screen
        .getByRole("link", { name: /セッション全文を読む/ })
        .getAttribute("href"),
    ).toBe(record.currentUrl);
  });

  it("routes the full-session CTA to currentUrl once the session is published (③)", () => {
    const publishedRecord: SessionRecord = {
      ...record,
      liveStatus: "closed",
      articleStatus: "published",
      canonicalArticleUrl: record.currentUrl,
      publishedAt: "2026-07-10T06:00:00+09:00",
    };
    render(
      <SessionNowCard
        record={publishedRecord}
        provenance={provenance}
        copy={copy}
      />,
    );
    expect(
      screen
        .getByRole("link", { name: /セッション全文を読む/ })
        .getAttribute("href"),
    ).toBe(publishedRecord.currentUrl);
  });

  it("routes the full-session CTA to /sessions/archive when the record is feed-origin and not yet materialized (①)", () => {
    const feedOnlyRecord: SessionRecord = {
      ...record,
      hasMaterializedRoute: false,
    };
    render(
      <SessionNowCard
        record={feedOnlyRecord}
        provenance={provenance}
        copy={copy}
      />,
    );
    expect(
      screen
        .getByRole("link", { name: /セッション全文を読む/ })
        .getAttribute("href"),
    ).toBe("/sessions/archive");
  });

  it("routes an editorial feed session to the same currentUrl and shows exactly the first two lead sentences", () => {
    const feedEditorialRecord: SessionRecord = {
      ...record,
      editorial,
      hasMaterializedRoute: false,
    };
    const { container } = render(
      <SessionNowCard
        record={feedEditorialRecord}
        provenance={provenance}
        copy={copy}
      />,
    );
    expect(container).toHaveTextContent(
      "市場は政策発言を受けて方向感を探っている。一次情報では次の判断材料が示された。",
    );
    expect(container).not.toHaveTextContent("三文目はカードに出さない");
    expect(
      screen.getByRole("link", { name: "インテリジェンス 2 本 →" }),
    ).toHaveAttribute("href", record.currentUrl);
  });

  it("hides editorial content for the English surface", () => {
    const { container } = render(
      <SessionNowCard
        record={{ ...record, editorial, hasMaterializedRoute: false }}
        provenance={provenance}
        copy={copy}
        showEditorial={false}
      />,
    );
    expect(container).not.toHaveTextContent(editorial.lead);
    expect(screen.queryByText(/インテリジェンス 2 本/)).toBeNull();
    expect(
      screen.getByRole("link", { name: /セッション全文を読む/ }),
    ).toHaveAttribute("href", record.currentUrl);
  });
});
