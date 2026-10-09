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

import { SessionScheduleCard } from "@/components/home/SessionScheduleCard";
import { getTodaySchedule } from "@/lib/sessions/session-content";
import type { SessionRecord } from "@/lib/sessions/session-content";
import { READER_SESSIONS } from "@/lib/sessions/session-registry";

const schedule = READER_SESSIONS.map((def) => ({
  def,
  isCurrent: def.slug === "europe-bridge",
  current: undefined, // getTodaySchedule の current 型 = SessionRecord | undefined
  previous: undefined, // getTodaySchedule の previous 型 = SessionRecord | undefined
})) satisfies ReturnType<typeof getTodaySchedule>;

const record = (overrides: Partial<SessionRecord>): SessionRecord => ({
  sessionId: "2026-10-08-asia-open",
  date: "2026-10-08",
  sessionSlug: "asia-open",
  liveStatus: "closed",
  articleStatus: "published",
  currentUrl: "/sessions/2026-10-08-asia-open",
  canonicalArticleUrl: "/sessions/2026-10-08-asia-open",
  publishedAt: "2026-10-09T02:30:00+09:00",
  publishLogId: null,
  packetId: "sess_20261008_asia",
  asOfJst: "2026-10-08T07:30:00+09:00",
  focusInstruments: ["nikkei_futures", "usd_jpy"],
  titleJa: "Asia Open Terminal",
  bullets: ["前日"],
  focusFallbackApplied: false,
  bodyJa: "# body",
  hasMaterializedRoute: true,
  ...overrides,
});

const copy = {
  title: "本日の更新予定",
  previous: "前回（{date}）を読む →",
  live: "ライブを読む →",
  archive: "セッション記事の一覧 →",
  compactBadge: "本日あと2回更新",
  compactPrevious: "前回セッションの記事を読む",
  focusPrefix: "注目:",
};

describe("SessionScheduleCard", () => {
  it("shows all four slots with focus preview", () => {
    render(<SessionScheduleCard schedule={schedule} copy={copy} />);
    expect(screen.getByText("Asia Open Terminal")).toBeInTheDocument();
    expect(screen.getByText("Europe Bridge Terminal")).toBeInTheDocument();
    expect(screen.getByText("NY Open Terminal")).toBeInTheDocument();
    expect(
      screen.getByText("Global Close / Frontier Terminal"),
    ).toBeInTheDocument();
    // 一意な focus 名で preview を検査（米10年金利=us10y は europe/ny の2行に
    // 出て複数一致するため使わない）。
    expect(screen.getByText(/EUR\/USD/)).toBeInTheDocument(); // europe-bridge focus（一意）
    expect(screen.getByText(/日経225/)).toBeInTheDocument(); // asia-open focus（一意）
  });

  // 2026-10-09 田平氏 GO: 現在行が昨日の回へ飛んで「更新されていない」に見えた
  // (10/9 09:03 の Asia Open 行 → 10/8)。現在行は今日のライブへ、他の行は日付付き。
  it("links the current row to today's live session, not the previous one", () => {
    const yesterday = record({});
    const todayLive = record({
      sessionId: "2026-10-09-asia-open",
      date: "2026-10-09",
      liveStatus: "live",
      articleStatus: "pending",
      currentUrl: "/sessions/2026-10-09-asia-open",
      canonicalArticleUrl: null,
      publishedAt: null,
      asOfJst: "2026-10-09T07:30:00+09:00",
      bodyJa: null,
      hasMaterializedRoute: false,
    });
    const europeYesterday = record({
      sessionId: "2026-10-08-europe-bridge",
      sessionSlug: "europe-bridge",
      currentUrl: "/sessions/2026-10-08-europe-bridge",
      canonicalArticleUrl: "/sessions/2026-10-08-europe-bridge",
      asOfJst: "2026-10-08T12:03:00+09:00",
    });
    const liveSchedule = getTodaySchedule("2026-10-09", todayLive, [
      todayLive,
      europeYesterday,
      yesterday,
    ]);
    render(<SessionScheduleCard schedule={liveSchedule} copy={copy} />);

    const liveLink = screen.getByRole("link", { name: "ライブを読む →" });
    expect(liveLink).toHaveAttribute("href", "/sessions/2026-10-09-asia-open");
    const previousLink = screen.getByRole("link", {
      name: "前回（10/8）を読む →",
    });
    expect(previousLink).toHaveAttribute(
      "href",
      "/sessions/2026-10-08-europe-bridge",
    );
    // asia-open 行は前回リンク (10/8) を出さない — 1 行にリンクは 1 本
    expect(
      screen
        .getAllByRole("link")
        .filter(
          (link) =>
            link.getAttribute("href") === "/sessions/2026-10-08-asia-open",
        ),
    ).toHaveLength(0);
  });
});
