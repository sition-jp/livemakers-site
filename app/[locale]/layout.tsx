import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { routing } from "@/i18n/routing";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";

// Self-hosted via next/font so the design typeface renders identically on
// every device (2026-07-04 review: system fallbacks drifted to serif when
// Inter / Noto Sans JP were not installed locally). --font-sans in
// globals.css consumes these variables.
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
  const chromeMeta = getSnapshotChromeMeta();

  // Applies a stored dark preference before first paint so there is no
  // light-flash for returning dark users. Light is the default and needs no
  // attribute; suppressHydrationWarning covers the client-set data-theme.
  const themeInitScript = `try{if(localStorage.getItem("lmk-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansJp.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <NextIntlClientProvider messages={messages}>
          <SiteChrome chromeMeta={chromeMeta}>{children}</SiteChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
