/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * G3 (2026-09-11 田平氏 GO): Publisher Center 前提条件のページ 3 本
 * (編集方針・連絡先・プライバシー) — 実在する ja/en の翻訳を使って
 * レンダリングし、Google News チェックリストが要求する事実
 * (運営者・AI+人間検証・訂正方針・引用ポリシー・連絡手段・収集情報) が
 * 実際に画面へ出ることを確認する。
 */
vi.mock("next-intl/server", async () => {
  const ja = (await import("@/messages/ja.json")).default;
  const en = (await import("@/messages/en.json")).default;
  const messagesFor = (locale: string) => (locale === "en" ? en : ja);
  return {
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async (arg?: string | { locale: string; namespace: string }) => {
      const locale =
        typeof arg === "object" && arg && "locale" in arg ? arg.locale : "ja";
      const namespace =
        typeof arg === "object" && arg && "namespace" in arg ? arg.namespace : (arg as string);
      const messages = messagesFor(locale) as unknown as Record<string, Record<string, string>>;
      const bundle = messages[namespace] ?? {};
      return (key: string) => bundle[key] ?? key;
    }),
  };
});

import EditorialPolicyPage, {
  generateMetadata as editorialPolicyMetadata,
} from "@/app/[locale]/editorial-policy/page";
import ContactPage, { generateMetadata as contactMetadata } from "@/app/[locale]/contact/page";
import PrivacyPage, { generateMetadata as privacyMetadata } from "@/app/[locale]/privacy/page";

describe("editorial policy page", () => {
  it("states the operator, AI+human verification, sourcing, corrections, and citation policy", async () => {
    render(await EditorialPolicyPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getAllByText(/SITION Group.*田平茂樹/).length).toBeGreaterThan(0);
    expect(screen.getByText(/AI.*使っています/)).toBeInTheDocument();
    expect(screen.getByText(/一次ソースで検証/)).toBeInTheDocument();
    expect(screen.getByText(/訂正した旨と更新日時/)).toBeInTheDocument();
    expect(screen.getByText(/出典 \(媒体名 \+ URL\) を明記/)).toBeInTheDocument();
  });

  it("declares hreflang alternates for the page itself", async () => {
    const meta = await editorialPolicyMetadata({ params: Promise.resolve({ locale: "ja" }) });
    expect(meta.alternates?.canonical).toBe("/ja/editorial-policy");
    expect(meta.alternates?.languages).toMatchObject({
      ja: "/ja/editorial-policy",
      en: "/en/editorial-policy",
    });
  });
});

describe("contact page", () => {
  it("links only to the X DM and the SITION site, and invents no email address", async () => {
    render(await ContactPage({ params: Promise.resolve({ locale: "ja" }) }));
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toEqual(
      expect.arrayContaining(["https://x.com/LiveMakersCom", "https://sition.jp"]),
    );
    expect(document.body.textContent).not.toMatch(/mailto:/);
    expect(document.body.textContent).not.toMatch(/@\w[\w.-]*\.(com|jp|co)\b/);
  });

  it("has generateMetadata", async () => {
    const meta = await contactMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.alternates?.canonical).toBe("/en/contact");
  });
});

describe("privacy page", () => {
  it("describes Vercel access logs, no analytics/cookies, and theme-only localStorage", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getByText(/Vercel/)).toBeInTheDocument();
    expect(screen.getByText(/Google Analytics/)).toBeInTheDocument();
    expect(screen.getByText(/localStorage/)).toBeInTheDocument();
    expect(screen.getByText(/追跡目的の Cookie を発行していません/)).toBeInTheDocument();
  });

  it("has generateMetadata", async () => {
    const meta = await privacyMetadata({ params: Promise.resolve({ locale: "ja" }) });
    expect(meta.alternates?.canonical).toBe("/ja/privacy");
  });
});
