import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Fragment } from "react";

import { HomeComposition } from "@/components/home/HomeComposition";
import { OrganizationJsonLd } from "@/components/seo/OrganizationJsonLd";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadEffectiveSurfacePublished } from "@/lib/future-atlas/surface";
import { buildHomeCopy } from "@/lib/home/home-copy";
import { loadHomeCompositionProps } from "@/lib/home/load-home-composition";
import {
  countRemainingSessions,
  resolveNextSession,
} from "@/lib/sessions/next-session";
import { READER_SESSIONS } from "@/lib/sessions/session-registry";
import { localeAlternates } from "@/lib/seo/locale-alternates";

export const revalidate = 21600;

// タイトル・説明は root layout の既定値 (トップ用) をそのまま使う。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates(locale) };
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const { props, catalogSource, radarSource, sessionsSource } =
    await loadHomeCompositionProps();
  const futureAtlas = await loadFutureAtlas();
  const surfacePublished = await loadEffectiveSurfacePublished(futureAtlas);
  // 2026-08-23 田平氏 GO (spec 2026-08-23-terminal-switching-ux-design §B):
  // live があれば従来どおり live + 1 (12:03–12:45 の配信待ち窓で「Europe
  // Bridge 12:03」と出るのは配信待ちの表現として正しい)。live が無い窓は
  // 時計ベース — 観測 RED の日に過ぎた時刻を「次」と言い続けない。残り回数は
  // 常に時計ベース。2026-10-26 段 1 で時間での作り直しは 6 時間になったが、
  // 残り回数が変わるのはセッション時刻だけで、その直後の cron (refresh-home)
  // が home を作り直すので表示はずれない。
  const now = new Date();
  const liveIndex = props.live
    ? READER_SESSIONS.findIndex(
        (session) => session.slug === props.live!.sessionSlug,
      )
    : -1;
  const nextSession =
    liveIndex >= 0
      ? READER_SESSIONS[(liveIndex + 1) % READER_SESSIONS.length]
      : resolveNextSession(now).def;
  const copy = buildHomeCopy(
    (key, values) => t(key as never, values as never),
    {
      sessionName: props.focusSessionSlug
        ? READER_SESSIONS.find(
            (session) => session.slug === props.focusSessionSlug,
          )!.nameEn
        : t("general.noLiveSession"),
      nextSessionName: nextSession.nameEn,
      nextSessionTime: nextSession.updateTimeLabel,
      remainingSessions: countRemainingSessions(now),
      signalTodayCount: props.slots.signalTimelineSummary.todayCount,
      signalLatestAt: props.slots.signalTimelineSummary.latestAt,
    },
  );

  return (
    <>
      <OrganizationJsonLd />
      {/* ticker + 来歴帯は 2026-08-14 に SiteChrome (全ページ共通 chrome) へ
          移設 — 本ページでの重複描画はしない */}
      {/* masthead は勾配台帳の対象外 (chrome 項 0) — data-ledger-group の
          外側・page 直下の全幅 header として描画する (G44 D8/P3-6)。 */}
      <header className="w-full">
        <div className="mx-auto max-w-[1760px] px-4 pt-6 md:px-8">
          {/* 2026-10-12: 3 句 (見る・読む・描く) になり mobile で折り返すため、
              句の途中では折らず区切り記号の直後だけで折る。split の奇数番は
              区切り直後の空白 (ja は空・en は半角スペース)。 */}
          <h1 className="text-xl font-bold text-text-primary md:text-2xl">
            {copy.masthead.title
              .split(/(?<=[・·])(\s*)/)
              .map((part, index) =>
                index % 2 === 0 ? (
                  <span key={index} className="whitespace-nowrap">
                    {part}
                  </span>
                ) : (
                  <Fragment key={index}>
                    {part}
                    <wbr />
                  </Fragment>
                ),
              )}
          </h1>
          <p className="mt-1 text-[11px] text-text-tertiary">
            {copy.masthead.subtitle}
          </p>
        </div>
      </header>
      <HomeComposition
        {...props}
        catalogSource={catalogSource}
        radarSource={radarSource}
        sessionsSource={sessionsSource}
        showSessionEditorial={locale === "ja"}
        locale={locale}
        copy={copy}
        surfacePublished={surfacePublished}
      />
    </>
  );
}
