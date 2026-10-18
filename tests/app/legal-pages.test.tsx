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
      const t = (key: string) => bundle[key] ?? key;
      // next-intl の t.rich 相当: `<tag>text</tag>` を tags[tag](text) に置き換える
      t.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) => {
        const parts: unknown[] = [];
        const pattern = /<(\w+)>(.*?)<\/\1>/g;
        const source = bundle[key] ?? key;
        let last = 0;
        for (const match of source.matchAll(pattern)) {
          parts.push(source.slice(last, match.index));
          parts.push(tags[match[1]](match[2]));
          last = (match.index ?? 0) + match[0].length;
        }
        parts.push(source.slice(last));
        return parts;
      };
      return t;
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
    expect(screen.getAllByText(/SITION \(代表: 田平茂樹\)/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/SITION\s+Group/i);
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
  it("describes Vercel access logs, Google Analytics (2026-10-19), and theme-only localStorage", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getByText(/Vercel/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "アクセス解析" })).toBeInTheDocument();
    expect(screen.getByText(/Google LLC が提供するアクセス解析ツール/)).toBeInTheDocument();
    expect(screen.getByText(/localStorage/)).toBeInTheDocument();
    expect(screen.getByText(/広告を目的とした Cookie は使用していません/)).toBeInTheDocument();
  });

  it("links to the Google Analytics opt-out add-on and Google's partner-sites policy", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getByRole("link", { name: "オプトアウト アドオン" })).toHaveAttribute(
      "href",
      "https://tools.google.com/dlpage/gaoptout?hl=ja",
    );
    expect(
      screen.getByRole("link", {
        name: "Google のサービスを使用するサイトやアプリから収集した情報の Google による使用",
      }),
    ).toHaveAttribute("href", "https://policies.google.com/technologies/partner-sites?hl=ja");
  });

  it("discloses that embedded X posts, YouTube videos and source preview images load from external services (2026-10-06)", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getByRole("heading", { level: 2, name: "外部サービスの埋め込み" })).toBeInTheDocument();
    expect(screen.getByText(/youtube-nocookie\.com/)).toBeInTheDocument();
  });

  it("has generateMetadata", async () => {
    const meta = await privacyMetadata({ params: Promise.resolve({ locale: "ja" }) });
    expect(meta.alternates?.canonical).toBe("/ja/privacy");
  });
});
