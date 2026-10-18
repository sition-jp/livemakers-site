/**
 * Google Analytics 4 (2026-10-19 田平氏 GO)。
 *
 * 測定 ID は GA4 プロパティ「LiveMakers」(559487085) の web stream
 * `livemakers.com`。HTML に公開される値なので秘密ではない。
 *
 * 本番 (VERCEL_ENV=production) だけで読み込む。Preview / ローカル / テストの
 * 閲覧を本番の数字に混ぜないため。プライバシーポリシー (messages の
 * privacy.analyticsBody) はこのタグがある前提で書いている — 外すなら文面も戻す。
 */
export const GA_MEASUREMENT_ID = "G-437J767WN7";

export function shouldLoadAnalytics(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}

export function gaInitSnippet(measurementId: string): string {
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js',new Date());",
    `gtag('config','${measurementId}');`,
  ].join("");
}
