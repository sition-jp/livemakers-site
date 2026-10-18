import Script from "next/script";
import {
  GA_MEASUREMENT_ID,
  gaInitSnippet,
  shouldLoadAnalytics,
} from "@/lib/analytics";

/**
 * GA4 の gtag.js。本番だけ描画する (lib/analytics.ts)。
 * クライアント側のページ遷移は GA4 の拡張計測 (ブラウザ履歴の変化) が
 * page_view として数えるので、遷移ごとの送信はここでは書かない。
 */
export function GoogleAnalytics() {
  if (!shouldLoadAnalytics(process.env.VERCEL_ENV)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {gaInitSnippet(GA_MEASUREMENT_ID)}
      </Script>
    </>
  );
}
