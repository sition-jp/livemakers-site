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
import { READER_SESSIONS } from "@/lib/sessions/session-registry";

const schedule = READER_SESSIONS.map((def) => ({
  def,
  isCurrent: def.slug === "europe-bridge",
  previous: undefined, // getTodaySchedule の previous 型 = SessionRecord | undefined
})) satisfies ReturnType<typeof getTodaySchedule>;

const copy = {
  title: "本日の更新予定",
  previous: "前回を読む →",
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
    expect(screen.getByText(/DXY/)).toBeInTheDocument(); // europe-bridge focus（一意）
    expect(screen.getByText(/日経平均先物/)).toBeInTheDocument(); // asia-open focus（一意）
  });
});
