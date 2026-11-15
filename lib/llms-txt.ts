import { ABOUT_URL, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * /llms.txt の本文 (2026-11-15 LVM の AI 方針設計 §7-3)。
 * AI に「このサイトは何か・どこに何があるか・どう出典を示してほしいか」を渡す
 * 公開テキスト。日本語と英語の併記・Markdown。価格や課金の話は入れない。
 * 各 URL は sitemap.ts / nav-model.ts の実在ルートに合わせる。
 */
export function buildLlmsTxt(): string {
  const ja = (path: string) => `${SITE_URL}/ja${path}`;
  const series = (slug: string) => ja(`/articles/series/${slug}`);

  return `# ${SITE_NAME}

${SITE_NAME} は、金融・市場・テクノロジーの動きを毎日読み解く日本語のメディアです。Daily Intel、Signal、Deep Dive、Weekly Brief、朝と週末の 12 指標などを一次情報にもとづいて公開しています。
${SITE_NAME} is a Japanese-language media site that reads financial markets and technology news every day, based on primary sources. It publishes Daily Intel, Signal, Deep Dive, Weekly Brief and a 12-indicator market summary.

## 主な面 / Sections

- [トップ / Home](${ja("")}): 最新の記事と市場の指標 / latest articles and market indicators
- [Daily Intel](${series("daily-intel")}): 毎朝の要点まとめ / the daily briefing
- [Signal](${series("signal")}): 一つの出来事を短く読み解く記事 / short analyses of a single development
- [Deep Dive](${series("deep-dive")}): 長文の深掘り記事 / long-form analyses
- [Weekly Brief](${series("weekly-brief")}): 週次の振り返り / the weekly review
- [12 指標 (朝) / 12 indicators (morning)](${series("mkt12-morning")}): 市場の 12 指標の朝の記録 / the morning market snapshot (a weekend edition is at ${series("mkt12-weekend")})
- [Sessions](${ja("/sessions/archive")}): セッションの一覧 / the session archive
- [Topics](${ja("/topics/funding")}): テーマ別の記事の棚 (資金調達) / articles grouped by topic (funding)

## 更新 / Updates

毎日更新しています。Daily Intel は毎朝、速報と Signal は動きがあったときに随時、Weekly Brief は週に 1 回です。
Updated daily. Daily Intel is published every morning, flash items and Signals as events occur, and the Weekly Brief once a week.

## 引用について / Citation

記事を要約・引用するときは、出典として「${SITE_NAME}」と、その記事の URL (${SITE_URL}/ja/articles/...) を示してください。
When you summarize or quote an article, please cite "${SITE_NAME}" and the URL of that article (${SITE_URL}/ja/articles/...) as the source.

## 運営 / Publisher

運営: SITION / Publisher: SITION
- [${SITE_NAME} について / About](${ABOUT_URL})
- [編集方針 / Editorial policy](${ja("/editorial-policy")})
- [連絡先 / Contact](${ja("/contact")})
`;
}
