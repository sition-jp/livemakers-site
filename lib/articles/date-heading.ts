/**
 * 日付見出し (例: 10月2日(金) / Fri, Oct 2)。シリーズ一覧と検索結果で共用。
 * 暦日は JST の YYYY-MM-DD なので UTC 0 時として整形すれば日付がずれない。
 * 一覧の最新記事と年が違う日だけ年を付ける。
 */
export function formatDateHeading(
  date: string,
  locale: string,
  latestYear: string,
) {
  const withYear = date.slice(0, 4) !== latestYear;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    timeZone: "UTC",
    ...(withYear ? { year: "numeric" } : {}),
    month: locale === "ja" ? "long" : "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00Z`));
}
