import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ja"],
  // 2026-08-21 田平氏 GO: トップ=日本語固定。"/" は middleware が
  // defaultLocale へリダイレクトするので /ja に着地する。
  defaultLocale: "ja",
  // "always" で全 URL に locale 接頭辞 (/ja | /en) を保つ。公開
  // パイプライン (sub-repo livemakers_export) の canonical URL が
  // https://livemakers.com/ja/articles/... で固定されているため、
  // ja を無接頭化する "as-needed" への変更は禁止 — 既公開 URL と
  // revalidate 契約 (lib/revalidate.ts の PATH_RE) が全部
  // リダイレクト化してしまう。
  localePrefix: "always",
  // Accept-Language / cookie による自動判定は引き続き無効。locale は
  // URL だけで決まり、切替はヘッダの明示トグルで行う。2026-04-12 に
  // 自動判定 + cookie リダイレクトが明示 URL と喧嘩して EN トップが
  // 到達不能になった経緯があり、判定レイヤーは復活させない。
  localeDetection: false,
});
