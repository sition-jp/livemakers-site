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

/**
 * G39-A3: the surface is themed entirely by the --lmk-* token layer.
 * The local Light/Dark toggle sets data-theme on the surface root, and the
 * token variables flip for the subtree ([data-theme] selectors in
 * globals.css) — no per-theme class objects, no beige/cream palette, light
 * by default. Sections are flattened to rule + label headings (cards only
 * for repeated items), matching the homepage terminal.
 */

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <h2 className="mb-4 border-t border-border-primary pt-3 text-xs font-semibold uppercase tracking-label text-text-tertiary">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex border border-border-primary bg-bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-label text-text-secondary">
      {children}
    </span>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
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

  return (
    <section
      className="min-h-screen bg-bg-primary text-text-primary"
      data-testid="terminal-preview-surface"
      data-theme={themeName}
    >
      <div className="mx-auto max-w-[1920px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border-primary pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-logo text-pillar-market">
              LIVEMAKERS
            </div>
            <div className="mt-1 text-xs uppercase tracking-label text-text-tertiary">
              Terminal Preview / Static Mock
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              aria-label="Preview theme"
              className="flex border border-border-primary bg-bg-secondary p-1"
              role="group"
            >
              {(["light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  aria-pressed={themeName === option}
                  className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-label transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-pillar-overview ${
                    themeName === option
                      ? "bg-text-primary text-bg-primary"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                  onClick={() => setThemeName(option)}
                  type="button"
                >
                  {option === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
            <Badge>{copy.mockBadge}</Badge>
            <Badge>{copy.fixtureOnly}</Badge>
          </div>
        </div>

        {/* Compact state header — the oversized hero is retired (G39-A3) */}
        <header className="mb-6 border-b border-border-primary pb-6">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-label text-pillar-market">
            {data.terminalState.posture.replaceAll("_", " ")}
          </div>
          <h1 className="mb-2 text-xl font-light tracking-title text-text-primary md:text-2xl">
            {pick(data.terminalState.label, locale)}
          </h1>
          <p className="max-w-4xl text-sm leading-relaxed text-text-secondary">
            {pick(data.terminalState.summary, locale)}
          </p>
          <p className="mt-3 font-mono text-xs text-text-tertiary">
            {data.terminalState.asOfJst}
          </p>
        </header>

        <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Panel title={pick(data.publicTopology.liveRadar.title, locale)}>
            <div className="space-y-3">
              {data.publicTopology.liveRadar.items.map((item) => (
                <article
                  key={item.id}
                  className="min-w-0 border border-border-primary bg-bg-secondary/60 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill>{pick(item.sourceLabel, locale)}</StatusPill>
                    <span className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                      {item.family}
                    </span>
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-text-primary">
                    {pick(item.title, locale)}
                  </h3>
                  <p className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                    {pick(item.freshnessLabel, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title={pick(data.publicTopology.articleNewsFeed.title, locale)}>
            <div className="divide-y divide-border-primary">
              {data.publicTopology.articleNewsFeed.items.map((item) => (
                <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill>{item.family}</StatusPill>
                    <span className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                      {item.publishedAt}
                    </span>
                  </div>
                  <a className="group block" href={item.href}>
                    <h3 className="mb-2 text-sm font-semibold text-text-primary group-hover:underline">
                      {pick(item.title, locale)}
                    </h3>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {pick(item.excerpt, locale)}
                    </p>
                  </a>
                </article>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Current-state strip">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
            {data.indicators.map((item) => (
              <div
                key={item.id}
                className="min-h-28 min-w-0 border border-border-primary bg-bg-secondary/60 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-semibold uppercase tracking-label text-text-tertiary">
                    {item.label}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-label text-pillar-market">
                    {item.freshness}
                  </span>
                </div>
                <div className="mb-2 truncate text-xl font-light tabular-nums tracking-title text-text-primary">
                  {item.value}
                </div>
                <p className="text-xs leading-relaxed text-text-tertiary">
                  {pick(item.note, locale)}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel title="What happened">
            <div className="space-y-4">
              {data.developments.map((item) => (
                <article
                  key={item.id}
                  className="border-b border-border-primary pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge>{item.confidence}</Badge>
                    <span className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                      {pick(item.sourceNote, locale)}
                    </span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-text-primary">
                    {pick(item.label, locale)}
                  </h3>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {pick(item.summary, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Leading indicators">
            <div className="space-y-3">
              {data.watchItems.map((item) => (
                <article
                  key={item.id}
                  className="min-w-0 border border-border-primary bg-bg-secondary/60 p-4"
                >
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-label text-pillar-governance">
                    {item.horizon}
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-text-primary">
                    {pick(item.title, locale)}
                  </h3>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {pick(item.body, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Scenario radar">
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
              {data.scenarios.map((item) => (
                <article
                  key={item.id}
                  className="min-w-0 border border-border-primary bg-bg-secondary/60 p-4"
                >
                  <h3 className="mb-2 text-sm font-semibold text-pillar-overview">
                    {pick(item.title, locale)}
                  </h3>
                  <p className="mb-3 text-sm leading-relaxed text-text-secondary">
                    {pick(item.body, locale)}
                  </p>
                  <p className="text-xs leading-relaxed text-text-tertiary">
                    {pick(item.invalidation, locale)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Featured brief">
            <div className="mb-3">
              <Badge>{data.featuredBrief.status.replaceAll("_", " ")}</Badge>
            </div>
            <h3 className="mb-3 text-lg font-light tracking-title text-text-primary">
              {pick(data.featuredBrief.title, locale)}
            </h3>
            <p className="text-sm leading-relaxed text-text-secondary">
              {pick(data.featuredBrief.summary, locale)}
            </p>
          </Panel>

          <Panel title={copy.sourceLedgerTitle}>
            <div className="space-y-3">
              {data.sourceLedger.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-border-primary pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary">
                      {pick(item.label, locale)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                      {item.confidence}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-text-tertiary">
                    {pick(item.limitation, locale)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="mt-6 border border-pillar-risk/40 bg-pillar-risk/10 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-label text-pillar-risk">
            {copy.boundaryTitle}
          </h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            {copy.boundaryBody}
          </p>
        </aside>
      </div>
    </section>
  );
}
