import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { routing } from "@/i18n/routing";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { GoogleAnalytics } from "@/components/layout/GoogleAnalytics";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadChromeProps } from "@/lib/home/load-home-composition";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import { pickClientMessages } from "@/lib/i18n/client-messages";

// Self-hosted via next/font so the design typeface renders identically on
// every device (2026-07-04 review: system fallbacks drifted to serif when
// Inter / Noto Sans JP were not installed locally). --font-sans in
// globals.css consumes these variables.
//
// G48 (2026-07-25): the variable classes MUST be applied to <html>, not
// <body>. globals.css declares --font-sans on :root, and a custom property
// whose value contains an unresolvable var() computes to the
// guaranteed-invalid value at the element where it is declared. With the
// classes on <body>, --font-inter was absent from :root, so --font-sans
// resolved to the empty string and every page silently fell back to the
// Tailwind default ui-sans-serif stack.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  // 2026-10-26 (PR-A): 共通の枠は記事カタログを読まない。カタログは 1.6MB で
  // データキャッシュに載らず、全ページの作り直しのたびに取得が走っていた。
  // 未来アトラスの nav も config だけで決める (T4-2 の feed 判定 = カタログ読みは、
  // 未来アトラスの本体ページ・一覧ページ側に残す)
  const chrome = await loadChromeProps();
  const futureAtlas = await loadFutureAtlas();
  const surfacePublished = futureAtlas.config.surfacePublished;
  const chromeMeta = getSnapshotChromeMeta(chrome.snapshot);

  // Applies a stored dark preference before first paint so there is no
  // light-flash for returning dark users. Light is the default and needs no
  // attribute; suppressHydrationWarning covers the client-set data-theme.
  const themeInitScript = `try{if(localStorage.getItem("lmk-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoSansJp.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* ISR コスト doctrine (2026-10-26): 全ページに焼き込まれるので
            chrome 分の辞書だけを渡す。ページ固有の client component は
            ScopedIntlProvider で包む (lib/i18n/client-messages.ts) */}
        <NextIntlClientProvider messages={pickClientMessages(messages, "chrome")}>
          <SiteChrome
            chromeMeta={chromeMeta}
            futureAtlasNav={surfacePublished}
            tickerItems={chrome.tickerItems}
            pageProvenance={chrome.pageProvenance}
          >
            {children}
          </SiteChrome>
        </NextIntlClientProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
