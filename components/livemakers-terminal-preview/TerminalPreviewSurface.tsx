"use client";

import { useState } from "react";
import type {
  LocalizedText,
  TerminalPreviewLocale,
  TerminalPreviewMock,
} from "@/lib/livemakers-terminal-preview/types";

export interface TerminalPreviewCopy {
  mockBadge: string;
  fixtureOnly: string;
  unavailable: string;
  boundaryTitle: string;
  boundaryBody: string;
  sourceLedgerTitle: string;
}

function pick(text: LocalizedText, locale: TerminalPreviewLocale): string {
  return locale === "ja" ? text.ja : text.en;
}

type PreviewThemeName = "light" | "dark";

interface PreviewTheme {
  root: string;
  masthead: string;
  logo: string;
  meta: string;
  themeGroup: string;
  activeThemeButton: string;
  inactiveThemeButton: string;
  panel: string;
  panelTitle: string;
  badge: string;
  hero: string;
  posture: string;
  heroTitle: string;
  body: string;
  mono: string;
  card: string;
  label: string;
  accent: string;
  metric: string;
  muted: string;
  divider: string;
  warmAccent: string;
  scenarioTitle: string;
  ledgerName: string;
  boundary: string;
  boundaryTitle: string;
}

const themes: Record<PreviewThemeName, PreviewTheme> = {
  light: {
    root: "min-h-screen bg-[#f7f5ef] text-[#18202d]",
    masthead: "mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8c9] pb-4",
    logo: "text-[#2563eb]",
    meta: "text-[#64748b]",
    themeGroup: "border border-[#d8d2c4] bg-white",
    activeThemeButton: "bg-[#18202d] text-white",
    inactiveThemeButton: "text-[#64748b] hover:bg-[#f3f0e8] hover:text-[#18202d]",
    panel: "border border-[#ddd8cc] bg-white p-5 shadow-[0_1px_0_rgba(24,32,45,0.04)]",
    panelTitle: "text-[#6b7280]",
    badge: "border-[#d8d2c4] bg-[#fffaf0] text-[#475569]",
    hero: "border-[#d8d2c4] bg-[#fffaf0] shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
    posture: "text-[#0891b2]",
    heroTitle: "text-[#111827]",
    body: "text-[#475569]",
    mono: "text-[#64748b]",
    card: "border-[#e4dfd3] bg-[#fafafa]",
    label: "text-[#64748b]",
    accent: "text-[#2563eb]",
    metric: "text-[#111827]",
    muted: "text-[#64748b]",
    divider: "border-[#e4dfd3]",
    warmAccent: "text-[#b45309]",
    scenarioTitle: "text-[#2563eb]",
    ledgerName: "text-[#111827]",
    boundary: "border-[#fecaca] bg-[#fff1f2]",
    boundaryTitle: "text-[#b91c1c]",
  },
  dark: {
    root: "min-h-screen bg-[#070b12] text-[#e6edf7]",
    masthead: "mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#253043] pb-4",
    logo: "text-[#67e8f9]",
    meta: "text-[#94a3b8]",
    themeGroup: "border border-[#253043] bg-[#0d1420]",
    activeThemeButton: "bg-[#e6edf7] text-[#070b12]",
    inactiveThemeButton: "text-[#94a3b8] hover:bg-[#172033] hover:text-[#e6edf7]",
    panel: "border border-[#253043] bg-[#0d1420] p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)]",
    panelTitle: "text-[#94a3b8]",
    badge: "border-[#334155] bg-[#111827] text-[#cbd5e1]",
    hero: "border-[#2f3b52] bg-[#0b111c] shadow-[0_18px_60px_rgba(0,0,0,0.35)]",
    posture: "text-[#67e8f9]",
    heroTitle: "text-[#f8fafc]",
    body: "text-[#cbd5e1]",
    mono: "text-[#94a3b8]",
    card: "border-[#253043] bg-[#0a101a]",
    label: "text-[#94a3b8]",
    accent: "text-[#67e8f9]",
    metric: "text-[#f8fafc]",
    muted: "text-[#94a3b8]",
    divider: "border-[#253043]",
    warmAccent: "text-[#fbbf24]",
    scenarioTitle: "text-[#67e8f9]",
    ledgerName: "text-[#f8fafc]",
    boundary: "border-[#7f1d1d] bg-[#1f1115]",
    boundaryTitle: "text-[#fca5a5]",
  },
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function Panel({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: PreviewTheme;
}) {
  return (
    <section className={theme.panel}>
      <h2
        className={cx(
          "mb-4 text-xs font-semibold uppercase tracking-label",
          theme.panelTitle,
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Badge({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: PreviewTheme;
}) {
  return (
    <span
      className={cx(
        "inline-flex border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-label",
        theme.badge,
      )}
    >
      {children}
    </span>
  );
}

function StatusPill({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: PreviewTheme;
}) {
  return (
    <span
      className={cx(
        "inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label",
        theme.badge,
      )}
    >
      {children}
    </span>
  );
}

export function TerminalPreviewSurface({
  locale,
  data,
  copy,
}: {
  locale: TerminalPreviewLocale;
  data: TerminalPreviewMock;
  copy: TerminalPreviewCopy;
}) {
  const [themeName, setThemeName] = useState<PreviewThemeName>("light");
  const theme = themes[themeName];

  return (
    <section
      className={theme.root}
      data-testid="terminal-preview-surface"
      data-theme={themeName}
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className={theme.masthead}>
          <div>
            <div
              className={cx(
                "text-[11px] font-semibold uppercase tracking-logo",
                theme.logo,
              )}
            >
              LIVEMAKERS
            </div>
            <div className={cx("mt-1 text-xs uppercase tracking-label", theme.meta)}>
              Terminal Preview / Static Mock
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              aria-label="Preview theme"
              className={cx("flex p-1", theme.themeGroup)}
              role="group"
            >
              {(["light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  aria-pressed={themeName === option}
                  className={cx(
                    "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-label transition-colors",
                    themeName === option
                      ? theme.activeThemeButton
                      : theme.inactiveThemeButton,
                  )}
                  onClick={() => setThemeName(option)}
                  type="button"
                >
                  {option === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
            <Badge theme={theme}>{copy.mockBadge}</Badge>
            <Badge theme={theme}>{copy.fixtureOnly}</Badge>
          </div>
        </div>

        <header className={cx("mb-6 border p-6", theme.hero)}>
          <div
            className={cx(
              "mb-3 text-xs font-semibold uppercase tracking-label",
              theme.posture,
            )}
          >
            {data.terminalState.posture.replaceAll("_", " ")}
          </div>
          <h1
            className={cx(
              "mb-4 text-3xl font-light tracking-title md:text-5xl",
              theme.heroTitle,
            )}
          >
            {pick(data.terminalState.label, locale)}
          </h1>
          <p className={cx("max-w-4xl text-base leading-relaxed md:text-lg", theme.body)}>
            {pick(data.terminalState.summary, locale)}
          </p>
          <p className={cx("mt-4 font-mono text-xs", theme.mono)}>
            {data.terminalState.asOfJst}
          </p>
        </header>

        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
          <Panel title={pick(data.publicTopology.liveRadar.title, locale)} theme={theme}>
            <div className="space-y-3">
              {data.publicTopology.liveRadar.items.map((item) => (
                <article key={item.id} className={cx("border p-4", theme.card)}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill theme={theme}>{pick(item.sourceLabel, locale)}</StatusPill>
                    <span
                      className={cx(
                        "text-[10px] font-semibold uppercase tracking-label",
                        theme.muted,
                      )}
                    >
                      {item.family}
                    </span>
                  </div>
                  <h3 className={cx("mb-2 text-sm font-semibold", theme.metric)}>
                    {pick(item.title, locale)}
                  </h3>
                  <p className={cx("text-[10px] font-semibold uppercase tracking-label", theme.muted)}>
                    {pick(item.freshnessLabel, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel
            title={pick(data.publicTopology.articleNewsFeed.title, locale)}
            theme={theme}
          >
            <div className="divide-y divide-current/10">
              {data.publicTopology.articleNewsFeed.items.map((item) => (
                <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill theme={theme}>{item.family}</StatusPill>
                    <span
                      className={cx(
                        "text-[10px] font-semibold uppercase tracking-label",
                        theme.muted,
                      )}
                    >
                      {item.publishedAt}
                    </span>
                  </div>
                  <a className="group block" href={item.href}>
                    <h3
                      className={cx(
                        "mb-2 text-sm font-semibold group-hover:underline",
                        theme.metric,
                      )}
                    >
                      {pick(item.title, locale)}
                    </h3>
                    <p className={cx("text-sm leading-relaxed", theme.body)}>
                      {pick(item.excerpt, locale)}
                    </p>
                  </a>
                </article>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Current-state strip" theme={theme}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.indicators.map((item) => (
              <div
                key={item.id}
                className={cx("min-h-28 border p-4", theme.card)}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span
                    className={cx(
                      "text-xs font-semibold uppercase tracking-label",
                      theme.label,
                    )}
                  >
                    {item.label}
                  </span>
                  <span
                    className={cx(
                      "text-[10px] font-semibold uppercase tracking-label",
                      theme.accent,
                    )}
                  >
                    {item.freshness}
                  </span>
                </div>
                <div className={cx("mb-2 text-xl font-light tracking-title", theme.metric)}>
                  {item.value}
                </div>
                <p className={cx("text-xs leading-relaxed", theme.muted)}>
                  {pick(item.note, locale)}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <Panel title="What happened" theme={theme}>
            <div className="space-y-4">
              {data.developments.map((item) => (
                <article
                  key={item.id}
                  className={cx("border-b pb-4 last:border-b-0 last:pb-0", theme.divider)}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge theme={theme}>{item.confidence}</Badge>
                    <span
                      className={cx(
                        "text-[10px] font-semibold uppercase tracking-label",
                        theme.muted,
                      )}
                    >
                      {pick(item.sourceNote, locale)}
                    </span>
                  </div>
                  <h3 className={cx("mb-2 text-base font-semibold", theme.metric)}>
                    {pick(item.label, locale)}
                  </h3>
                  <p className={cx("text-sm leading-relaxed", theme.body)}>
                    {pick(item.summary, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Leading indicators" theme={theme}>
            <div className="space-y-3">
              {data.watchItems.map((item) => (
                <article
                  key={item.id}
                  className={cx("border p-4", theme.card)}
                >
                  <div
                    className={cx(
                      "mb-2 text-[10px] font-semibold uppercase tracking-label",
                      theme.warmAccent,
                    )}
                  >
                    {item.horizon}
                  </div>
                  <h3 className={cx("mb-2 text-sm font-semibold", theme.metric)}>
                    {pick(item.title, locale)}
                  </h3>
                  <p className={cx("text-sm leading-relaxed", theme.body)}>
                    {pick(item.body, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Scenario radar" theme={theme}>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
              {data.scenarios.map((item) => (
                <article
                  key={item.id}
                  className={cx("border p-4", theme.card)}
                >
                  <h3 className={cx("mb-2 text-sm font-semibold", theme.scenarioTitle)}>
                    {pick(item.title, locale)}
                  </h3>
                  <p className={cx("mb-3 text-sm leading-relaxed", theme.body)}>
                    {pick(item.body, locale)}
                  </p>
                  <p className={cx("text-xs leading-relaxed", theme.muted)}>
                    {pick(item.invalidation, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Featured brief" theme={theme}>
            <div className="mb-3">
              <Badge theme={theme}>
                {data.featuredBrief.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <h3 className={cx("mb-3 text-lg font-light tracking-title", theme.metric)}>
              {pick(data.featuredBrief.title, locale)}
            </h3>
            <p className={cx("text-sm leading-relaxed", theme.body)}>
              {pick(data.featuredBrief.summary, locale)}
            </p>
          </Panel>

          <Panel title={copy.sourceLedgerTitle} theme={theme}>
            <div className="space-y-3">
              {data.sourceLedger.map((item) => (
                <div
                  key={item.id}
                  className={cx("border-b pb-3 last:border-b-0 last:pb-0", theme.divider)}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className={cx("text-sm font-medium", theme.ledgerName)}>
                      {pick(item.label, locale)}
                    </span>
                    <span
                      className={cx(
                        "text-[10px] font-semibold uppercase tracking-label",
                        theme.muted,
                      )}
                    >
                      {item.confidence}
                    </span>
                  </div>
                  <p className={cx("text-xs leading-relaxed", theme.muted)}>
                    {pick(item.limitation, locale)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <aside className={cx("mt-6 border p-5", theme.boundary)}>
          <h2
            className={cx(
              "mb-2 text-xs font-semibold uppercase tracking-label",
              theme.boundaryTitle,
            )}
          >
            {copy.boundaryTitle}
          </h2>
          <p className={cx("text-sm leading-relaxed", theme.body)}>
            {copy.boundaryBody}
          </p>
        </aside>
      </div>
    </section>
  );
}
