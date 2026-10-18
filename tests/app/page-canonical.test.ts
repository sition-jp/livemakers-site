import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";

/**
 * 2026-10-19 (田平氏依頼): Google 検索「livemakers」でトップが一番上に出ない。
 *
 * 原因は root layout の `canonical: "/ja"` とトップのタイトルが全ページの
 * 既定値になっていたこと — 独自 metadata の無い一覧・セッション・EN トップ
 * などが「トップの重複」を名乗っていた。各ページが自分自身を canonical に
 * し、トップと違うタイトルを持つことをここで固定する。
 */
vi.mock("next-intl/server", async () => {
  const ja = (await import("@/messages/ja.json")).default;
  const en = (await import("@/messages/en.json")).default;
  const lookup = (root: unknown, dotted: string): unknown =>
    dotted
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
        root,
      );
  return {
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async (arg?: string | { locale: string; namespace: string }) => {
      const locale = typeof arg === "object" && arg ? arg.locale : "ja";
      const namespace = typeof arg === "object" && arg ? arg.namespace : (arg ?? "");
      const bundle = lookup(locale === "en" ? en : ja, namespace);
      return (key: string, values?: Record<string, string>) => {
        const raw = lookup(bundle, key);
        if (typeof raw !== "string") return `${namespace}.${key}`;
        return raw.replace(/\{(\w+)\}/g, (_, name: string) => values?.[name] ?? `{${name}}`);
      };
    }),
  };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: () => null,
  redirect: vi.fn(),
}));

vi.mock("@/lib/terminal/live-market-feed", () => ({
  fetchLiveMarketData: vi.fn(async () => null),
}));

import { metadata as rootMetadata } from "@/app/layout";

const HOME_TITLE = "LiveMakers — Intelligence Terminal for the Financial Reboot";

type MetadataFn = (args: { params: Promise<Record<string, string>> }) => Promise<Metadata>;

// [ページ module, locale 接頭辞の後ろの path, 追加 params]
const STATIC_PAGES: Array<[string, string, Record<string, string>?]> = [
  ["@/app/[locale]/brief/page", "/brief"],
  ["@/app/[locale]/about/page", "/about"],
  ["@/app/[locale]/subscribe/page", "/subscribe"],
  ["@/app/[locale]/signals/page", "/signals"],
  ["@/app/[locale]/assets/page", "/assets"],
  ["@/app/[locale]/assets/[asset]/page", "/assets/btc", { asset: "btc" }],
  ["@/app/[locale]/intents/page", "/intents"],
  ["@/app/[locale]/turning-points/page", "/turning-points"],
  ["@/app/[locale]/turning-points/[asset]/page", "/turning-points/btc", { asset: "btc" }],
  ["@/app/[locale]/turning-points/backtest/page", "/turning-points/backtest"],
  ["@/app/[locale]/future-atlas/page", "/future-atlas"],
  ["@/app/[locale]/future-atlas/ledger/page", "/future-atlas/ledger"],
  ["@/app/[locale]/future-atlas/methodology/page", "/future-atlas/methodology"],
  ["@/app/[locale]/articles/today/page", "/articles/today"],
  ["@/app/[locale]/articles/series/[series]/page", "/articles/series/signal", { series: "signal" }],
  [
    "@/app/[locale]/articles/series/[series]/page/[page]/page",
    "/articles/series/signal/page/2",
    { series: "signal", page: "2" },
  ],
  ["@/app/[locale]/sessions/archive/page", "/sessions/archive"],
  ["@/app/[locale]/sessions/archive/past/page", "/sessions/archive/past"],
];

describe("root metadata no longer makes every page claim to be the top page", () => {
  it("does not declare a site-wide canonical", () => {
    expect(rootMetadata.alternates?.canonical).toBeUndefined();
  });

  it("keeps the home title as the default and brands child titles", () => {
    expect(rootMetadata.title).toEqual({ default: HOME_TITLE, template: "%s | LiveMakers" });
  });
});

describe("top page declares itself as canonical per locale", () => {
  it.each(["ja", "en"])("%s", async (locale) => {
    const { generateMetadata } = (await import("@/app/[locale]/page")) as unknown as {
      generateMetadata: MetadataFn;
    };
    const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(meta.alternates?.canonical).toBe(`/${locale}`);
    expect(meta.alternates?.languages).toEqual({ ja: "/ja", en: "/en", "x-default": "/ja" });
  });
});

describe("session article pages are self-canonical", () => {
  it.each(["ja", "en"])("%s", async (locale) => {
    const { getAllSessionRecords } = await import("@/lib/sessions/session-content");
    const published = getAllSessionRecords().find((r) => r.articleStatus === "published");
    expect(published).toBeDefined();
    const { generateMetadata } = (await import("@/app/[locale]/sessions/[slug]/page")) as unknown as {
      generateMetadata: MetadataFn;
    };
    const meta = await generateMetadata({
      params: Promise.resolve({ locale, slug: published!.sessionId }),
    });
    expect(meta.alternates?.canonical).toBe(`/${locale}/sessions/${published!.sessionId}`);
    expect(meta.title).toMatch(new RegExp(`${published!.date}$`));
    expect(meta.description).toBe(published!.titleJa);
  });
});

describe("inner pages are self-canonical and titled apart from the top page", () => {
  for (const [modulePath, path, extra] of STATIC_PAGES) {
    it.each(["ja", "en"])(`${path} (%s)`, async (locale) => {
      const mod = (await import(/* @vite-ignore */ modulePath)) as { generateMetadata?: MetadataFn };
      expect(mod.generateMetadata, `${modulePath} exports generateMetadata`).toBeTypeOf("function");
      const meta = await mod.generateMetadata!({ params: Promise.resolve({ locale, ...extra }) });
      expect(meta.alternates?.canonical).toBe(`/${locale}${path}`);
      expect(typeof meta.title).toBe("string");
      expect(meta.title).not.toBe(HOME_TITLE);
      expect(meta.title as string).not.toMatch(/^[a-zA-Z]+\.[\w.]+$/); // 翻訳キーの素通しではない
    });
  }
});
