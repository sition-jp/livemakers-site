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

  it("routes the full-session CTA to currentUrl even for a feed-origin record without editorial (① — 2026-08-23: same-URL live view resolves feed records, archive detour removed)", () => {
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
    ).toBe(record.currentUrl);
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

// 2026-08-23 田平氏 GO (spec §A): closed variant = 「直前に終わったセッション」。
// 本文は live と同じ・バッジだけ「終了」へ・live を示す語を出さない。
describe("SessionNowCard closed variant (2026-08-23 switching-gap fill)", () => {
  const closedRecord: SessionRecord = {
    ...record,
    liveStatus: "closed",
    asOfJst: "2026-07-10T07:30:00+09:00",
  };
  const closedCopy = { ...copy, closedBadgeSuffix: "JST 終了" };

  it("renders the ended badge, the snapshot line and the full-session CTA", () => {
    const { container } = render(
      <SessionNowCard
        record={closedRecord}
        provenance={provenance}
        copy={closedCopy}
        variant="closed"
      />,
    );
    expect(container.firstElementChild).toHaveAttribute(
      "data-session-state",
      "closed",
    );
    expect(screen.getByText("SESSION · 05:03 JST 終了")).toBeInTheDocument();
    expect(screen.queryByText(/JST 更新/)).toBeNull();
    expect(screen.getByText(/スナップショット/).textContent).toContain("07:30");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain(
      "米CPI通過後、最初のアジア時間",
    );
    const cta = screen.getByText("セッション全文を読む →");
    expect(cta.getAttribute("href")).toBe("/sessions/2026-07-10-asia-open");
    expect(container.textContent).not.toMatch(/\bLIVE\b/);
  });

  it("defaults to the live badge when variant is omitted", () => {
    render(
      <SessionNowCard record={record} provenance={provenance} copy={closedCopy} />,
    );
    expect(screen.getByText("SESSION · 05:03 JST 更新")).toBeInTheDocument();
  });
});

// 2026-08-23 田平氏 GO (spec 2026-08-23-digest-only-session-design §5):
// observationStatus=absent → 「読み解きのみ」バッジ・鮮度行は「読み解き」・
// 市場来歴行の代わりに「数値スナップショットなし」注記。
describe("SessionNowCard digest-only (observationStatus=absent)", () => {
  const digestRecord: SessionRecord = {
    ...record,
    asOfJst: "2026-07-10T12:34:00+09:00",
    titleJa: "Asia Open Terminal — 7月10日 05:03 JST（読み解きのみ）",
    bullets: ["一次情報で確認された主要な動き"],
    observationStatus: "absent",
    editorial,
  };
  const digestCopy = {
    ...copy,
    closedBadgeSuffix: "JST 終了",
    digestOnlyLabel: "読み解きのみ",
    digestFreshnessPrefix: "読み解き",
    noSnapshotNote: "数値スナップショットなし（市場観測が未取得）",
  };

  it("renders the digest-only badge, digest freshness line and the no-snapshot note instead of provenance", () => {
    const { container } = render(
      <SessionNowCard record={digestRecord} provenance={provenance} copy={digestCopy} />,
    );
    expect(container.firstElementChild).toHaveAttribute("data-session-observation", "absent");
    expect(screen.getByText("SESSION · 05:03 JST 更新 · 読み解きのみ")).toBeInTheDocument();
    expect(screen.getByText(/^読み解き /).textContent).toContain("2026-07-10 · 12:34 JST");
    expect(screen.queryByText(/スナップショット 2026/)).toBeNull();
    expect(screen.getByText("数値スナップショットなし（市場観測が未取得）")).toBeInTheDocument();
    expect(container.textContent).not.toContain("審査状態");
    expect(container.textContent).not.toContain("reviewed_live");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("一次情報で確認された主要な動き");
  });

  it("combines the ended badge with the digest-only marker when closed", () => {
    render(
      <SessionNowCard
        record={{ ...digestRecord, liveStatus: "closed" }}
        provenance={provenance}
        copy={digestCopy}
        variant="closed"
      />,
    );
    expect(screen.getByText("SESSION · 05:03 JST 終了 · 読み解きのみ")).toBeInTheDocument();
  });

  it("marks green records explicitly and keeps the provenance row", () => {
    const { container } = render(
      <SessionNowCard record={record} provenance={provenance} copy={digestCopy} />,
    );
    expect(container.firstElementChild).toHaveAttribute("data-session-observation", "green");
    expect(container.textContent).toContain("審査状態");
  });
});
