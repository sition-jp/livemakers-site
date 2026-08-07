/* @vitest-environment jsdom */
import fs from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HomeComposition } from "@/components/home/HomeComposition";
import { LeadingColumn } from "@/components/home/columns/LeadingColumn";
import {
  buildHomeCompositionProps,
  resolveHomeSessionsSource,
} from "@/lib/home/build-home-props";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import { mapTerminalFeed } from "@/lib/terminal/live-market-feed";

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

const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);
const copy = buildTestHomeCopy();

function sessionsFeedFixture() {
  const feed = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "tests/fixtures/terminal/terminal_feed_v0.3.home.sample.json",
      ),
      "utf8",
    ),
  );
  const data = mapTerminalFeed(feed);
  if (!data?.home || !data.sessions) {
    throw new Error("valid v0.3 sessions fixture did not map");
  }
  return { home: data.home, sessions: data.sessions };
}

function renderLeading(props: ReturnType<typeof buildHomeCompositionProps>) {
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

describe("home sessions rail — feed adoption end to end (G43-e S2)", () => {
  it("① renders the feed's today session as live and clears the 切替中 fallback", () => {
    const { home, sessions } = sessionsFeedFixture();
    const now = new Date("2026-07-12T08:00:00+09:00");
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
    });
    expect(resolveHomeSessionsSource({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
    })).toBe("feed_today");

    const { getByText, queryByText } = renderLeading(props);
    // bullets[0] is promoted to the headline (SessionNowCard) — distinguishes
    // the feed record from any repo/registry-static text (nameEn/titleJa are
    // not reliable discriminators: nameEn is a static per-slug registry
    // string, unrelated to which record source won adoption).
    expect(getByText(sessions.records[0].bullets[0])).toBeInTheDocument();
    expect(queryByText("現在のセッションは切替中です")).toBeNull();
  });

  it("② stays on the honest 切替中 fallback + next-update line when the feed sessions bundle is absent (P0-1b regression)", () => {
    // production-equivalent: no source, no feedSessions, and the article
    // clock has moved past the repo fixture's session date — mirrors the
    // pre-existing P0-1b gradient-columns.test.tsx regression gate.
    const props = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-08-07",
      contentDir: TEST_CONTENT_DIR,
    });
    expect(resolveHomeSessionsSource({})).toBe("repo");
    expect(props.live).toBeNull();

    const { getByText } = renderLeading(props);
    getByText("現在のセッションは切替中です");
    getByText("次の更新: Europe Bridge Terminal 12:03 JST");
  });

  it("surfaces sessionsSource through data-home-sessions-source on the HomeComposition root", () => {
    const { home, sessions } = sessionsFeedFixture();
    const now = new Date("2026-07-12T08:00:00+09:00");
    const adoptedProps = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
      contentDir: TEST_CONTENT_DIR,
    });
    const adoptedSource = resolveHomeSessionsSource({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [],
    });
    const { container: adoptedContainer } = render(
      <HomeComposition
        {...adoptedProps}
        sessionsSource={adoptedSource}
        surfacePublished={false}
        copy={copy}
      />,
    );
    expect(adoptedContainer.firstElementChild).toHaveAttribute(
      "data-home-sessions-source",
      "feed_today",
    );

    const repoProps = buildHomeCompositionProps({
      today: "2026-07-10",
      articleCutoffToday: "2026-07-10",
      contentDir: TEST_CONTENT_DIR,
    });
    const { container: repoContainer } = render(
      <HomeComposition
        {...repoProps}
        surfacePublished={false}
        copy={copy}
      />,
    );
    expect(repoContainer.firstElementChild).toHaveAttribute(
      "data-home-sessions-source",
      "repo",
    );
  });

  it("④ dedup: the feed record wins over a same-sessionId repo record and reflects at render time", () => {
    const { home, sessions } = sessionsFeedFixture();
    const now = new Date("2026-07-12T08:00:00+09:00");
    const staleRepoRecord = {
      sessionId: sessions.records[0].sessionId,
      date: sessions.records[0].date,
      sessionSlug: sessions.records[0].sessionSlug,
      liveStatus: "live" as const,
      articleStatus: "pending" as const,
      currentUrl: sessions.records[0].currentUrl,
      canonicalArticleUrl: null,
      publishedAt: null,
      publishLogId: null,
      packetId: "sess_20260712_asia_repo_stale",
      asOfJst: "2026-07-12T05:03:00+09:00",
      focusInstruments: ["btc_usd", "usd_jpy"] as const,
      titleJa: "REPO STALE TITLE",
      bullets: ["repo stale bullet 1", "repo stale bullet 2"],
      focusFallbackApplied: false,
      bodyJa: null,
    };
    const props = buildHomeCompositionProps({
      source: home,
      feedSessions: sessions,
      now,
      sessionRecords: [staleRepoRecord as never],
      contentDir: TEST_CONTENT_DIR,
    });
    const { getByText, queryByText } = renderLeading(props);
    expect(getByText(sessions.records[0].bullets[0])).toBeInTheDocument();
    expect(queryByText("repo stale bullet 1")).toBeNull();
  });
});
