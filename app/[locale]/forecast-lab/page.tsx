import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { loadForecastFeed, type Feed, type ScoreGroup, type TodayItem } from "@/lib/forecast-lab/feed";
import {
  HORIZON_JA, averageProbability, compareWord, leadItem, md, pct, questionName, usualLine,
} from "@/lib/forecast-lab/view";

/**
 * /forecast-lab — 予測サービス 段階 ② の内部ページ (パスワード付き・公開しない)。
 *
 * 設計 = core 08_DOCS/knowledge/specs/2026-11-27-lvm-forecast-app-stage2-design.md (案 A' 2026-11-27 田平氏)。
 * - 入口の鍵は proxy.ts + lib/forecast-lab/gate.ts (FORECAST_APP_PASSWORD が無ければ 404)
 * - 数字は非公開の台帳 repo の app_feed.json を、読み取り専用の鍵で毎回読む (この repo には置かない)
 * - 試作 v2 (core 08_DOCS/reports/lvm/forecast_app/prototype/) と同じ中身・言葉
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "予測サービス (内部)",
  robots: { index: false, follow: false },
};

const WX: Record<string, string> = { sunny: "☀", cloudy: "⛅", rain: "☔" };
const LM: Record<string, string> = { stablecoin_supply_yoy_flip: "ステーブルコインの供給 (前の年と比べた増減)" };
const card = "my-4 rounded-xl border border-border-primary bg-bg-secondary p-4";
const fine = "text-xs text-text-tertiary";

function Bar({ p, base }: { p: number; base: number }) {
  return (
    <div className="relative my-2 h-3 rounded-full bg-border-primary">
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${p * 100}%` }} />
      <div className="absolute -inset-y-1 w-0.5 bg-text-primary" style={{ left: `${base * 100}%` }} title="ふだん" />
    </div>
  );
}

function Question({ i }: { i: TodayItem }) {
  const c = compareWord(i.diff_pt);
  const tone = c.tone === "hi" ? "text-market-up" : c.tone === "lo" ? "text-market-down" : "text-text-tertiary";
  return (
    <div className="border-t border-border-primary py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{i.event === "turn" ? "天井か底" : "大きく動く"} — {HORIZON_JA[i.horizon]}</span>
        <span className={`rounded-full border border-border-primary px-2 text-xs ${tone}`}>{c.word}</span>
      </div>
      <Bar p={i.probability} base={i.base_rate} />
      <div className="text-sm text-text-secondary">
        AI <b className="text-base text-text-primary">{pct(i.probability)}</b> ・ ふだんの確率 {pct(i.base_rate)} (縦の線)
      </div>
      <div className={fine}>問い: {i.text}</div>
      <div className={fine}>{usualLine(i.base_info)}</div>
    </div>
  );
}

function Today({ feed }: { feed: Feed }) {
  const items = feed.today.items;
  const top = leadItem(items);
  const cy = feed.cycle;
  const tot = cy.totals ?? {};
  const line = (k: string, label: string) =>
    tot[k] ? `${label}: ☀ ${tot[k].sunny}・⛅ ${tot[k].cloudy}・☔ ${tot[k].rain}${tot[k].missing ? `・欠測 ${tot[k].missing}` : ""}` : null;
  return (
    <section id="today">
      <div className={`${card} text-lg font-bold`}>
        {top ? (
          <>今日いちばん「ふだん」と違うのは、{questionName(top)}確率です。ふだんより{top.diff_pt! > 0 ? "高く" : "低く"}見ています。
            <span className="mt-1 block text-sm font-normal text-text-secondary">
              AI は {pct(top.probability)}。ふだんの確率は {pct(top.base_rate)} です ({usualLine(top.base_info)})。</span></>
        ) : (
          <>今日は、どの問いも「ふだん」とほぼ同じです。
            <span className="mt-1 block text-sm font-normal text-text-secondary">AI の確率とふだんの差は、どれも 5 ポイント未満です。</span></>
        )}
      </div>
      {["BTC", "ETH"].map((a) => (
        <div key={a} className={card}>
          <h2 className="mb-1 font-bold">{a}</h2>
          {items.filter((x) => x.asset === a).sort((x, y) => (x.event + x.horizon).localeCompare(y.event + y.horizon))
            .map((i) => <Question key={`${i.event}${i.horizon}`} i={i} />)}
        </div>
      ))}
      <div className={card}>
        <h2 className="mb-1 font-bold">節目シグナル</h2>
        {feed.landmark.count ? feed.landmark.items.map((o) => (
          <div key={`${o.indicator}${o.lit_on}`} className="text-sm">● {LM[o.indicator] ?? o.indicator} — {md(o.lit_on)} に点灯
            ({o.direction === "negative" ? "下向き" : o.direction === "positive" ? "上向き" : o.direction})</div>
        )) : <div className={fine}>いま点灯している節目はありません。</div>}
        <div className={fine}>数年に数回だけ点灯する節目です。確率ではなく「点灯した・していない」で見ます。</div>
      </div>
      {cy.issue ? (
        <div className={card}>
          <h2 className="mb-1 font-bold">サイクル予報 #{cy.issue} ({md(cy.week)} の週)</h2>
          <div className="font-semibold">{[line("btc", "ビットコイン"), line("altseason", "アルトシーズン")].filter(Boolean).map((t) => <div key={t!}>{t}</div>)}</div>
          <div className={fine}>記事に出した全体の数です (本採用の指標だけ)。12 週後 ({md(cy.due_at)}) に答え合わせをします。
            試験中の指標 {cy.items.filter((r) => r.status !== "active").length} 本は数に入れません。</div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
            {cy.items.filter((r) => r.status === "active").map((r) => <div key={r.skill_id}>{WX[r.weather]} {r.name ?? r.skill_id}</div>)}
          </div>
          <div className={fine}>天気は「ふだんの割合」と比べて決めています。ふだんの割合 = その指標の値がある全部の週 (多くは 2011 年ごろから) のうち、12 週後に BTC が上がっていた週の割合。今日の予報の「ふだんの確率」とは、数える期間も単位も違います。</div>
        </div>
      ) : null}
    </section>
  );
}

function Scores({ feed }: { feed: Feed }) {
  const nat = feed.scores.filter((g) => g.scope === "natural");
  const all = feed.scores.filter((g) => g.scope === "all");
  const sum = (gs: ScoreGroup[]) => gs.reduce((a, g) => a + (g.resolved || 0), 0);
  const done = feed.readiness.live_natural_7d30d_resolved ?? 0;
  const goal = feed.readiness.public_target ?? 300;
  const pts = all.flatMap((g) => g.calibration ?? []);
  const W = 300, H = 220, pad = 30, X = (v: number) => pad + v * (W - pad - 10), Y = (v: number) => H - pad - v * (H - pad - 10);
  return (
    <section id="scores">
      <div className={`${card} text-lg font-bold`}>
        台帳に入ってから答えが出た予報は {sum(nat)} 件です。まだ少ないので、成績は「参考」として見てください。
        <span className="mt-1 block text-sm font-normal text-text-secondary">
          台帳を始める前の記録も含めると {sum(all)} 件。公開するのは、台帳に入ってからの答えが {goal} 件たまってからです。</span>
        <div className="my-2 h-2.5 overflow-hidden rounded-full bg-border-primary">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} /></div>
        <span className="text-sm font-normal text-text-secondary">公開の条件まで: {done} / {goal} 件</span>
      </div>
      <div className={card}>
        <h2 className="mb-1 font-bold">問いごとの成績</h2>
        {all.filter((g) => g.resolved).map((g) => {
          const n = nat.find((x) => x.asset === g.asset && x.event === g.event && x.horizon === g.horizon);
          const a = averageProbability(g.calibration), r = g.hits / g.resolved;
          const gap = a == null ? null : (r - a) * 100;
          const word = gap == null ? "" : gap >= 10 ? "AI の確率より多く起きた" : gap <= -10 ? "AI の確率より少なかった" : "AI の確率に近い";
          return (
            <div key={`${g.asset}${g.event}${g.horizon}`} className="border-t border-border-primary py-3 first:border-t-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{g.asset} {g.event === "turn" ? "天井か底" : "大きく動く"} — {HORIZON_JA[g.horizon]}</span>
                <span className="rounded-full border border-border-primary px-2 text-xs text-text-tertiary">{word}</span>
              </div>
              <div className="text-sm text-text-secondary">AI の平均 <b className="text-text-primary">{pct(a)}</b> → 実際に起きた{" "}
                <b className="text-text-primary">{pct(r)}</b> ({g.hits} / {g.resolved} 回)</div>
              <div className={fine}>台帳に入ってから: {n?.resolved ? `${n.hits} / ${n.resolved} 回` : "まだ答えなし"}</div>
            </div>
          );
        })}
        <div className={fine}>「起きた」は、問いの出来事が実際に起きた回数です。AI の確率が「起きた割合」に近いほど、確率の言い方が正確です。
          答えの出た日が近い予報は窓が重なるので、独立した例はこの件数より少なくなります。</div>
      </div>
      <div className={card}>
        <h2 className="mb-1 font-bold">AI が「◯割」と言った時、実際に何割起きたか</h2>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label="確率と実際の割合の図">
          <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 4" />
          <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(0)} stroke="currentColor" strokeOpacity={0.2} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(1)} stroke="currentColor" strokeOpacity={0.2} />
          {[0, 0.5, 1].map((v) => (
            <g key={v} fill="currentColor" fillOpacity={0.6} fontSize={11}>
              <text x={X(v)} y={H - 8} textAnchor="middle">{v * 100}%</text><text x={6} y={Y(v) + 4}>{v * 100}%</text></g>
          ))}
          {pts.map((c, k) => <circle key={k} cx={X(c.p)} cy={Y(c.rate)} r={3 + Math.sqrt(c.n) * 1.5} className="fill-accent" fillOpacity={0.55} />)}
        </svg>
        <div className={fine}>横 = AI の確率、縦 = 実際に起きた割合。点線の上に乗るほど正確。点が大きいほど件数が多い。台帳を始める前の記録も含みます。</div>
      </div>
      <div className={card}>
        <h2 className="mb-1 font-bold">最近の答え合わせ</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-text-tertiary"><th>答えの日</th><th>問い</th><th className="text-right">AI</th><th className="text-right">結果</th></tr></thead>
          <tbody>{feed.recent.slice(0, 12).map((x, k) => (
            <tr key={k} className="border-t border-border-primary">
              <td>{md(x.resolved_on)}</td>
              <td>{x.asset} {x.event === "turn" ? "天井か底" : "大きく動く"} {HORIZON_JA[x.horizon]}{x.before_ledger ? <span className={fine}> (台帳前)</span> : null}</td>
              <td className="text-right">{pct(x.probability)}</td>
              <td className="text-right">{x.outcome === "hit" ? "起きた" : "起きなかった"}</td>
            </tr>))}</tbody>
        </table>
        <div className={fine}>外れた予報も消さずに載せています。</div>
      </div>
    </section>
  );
}

export default async function ForecastLabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const feed = await loadForecastFeed();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-text-primary">
      <p className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-xs text-text-tertiary">
        内部用のページです。公開していません (パスワード付き・検索に出ません)。</p>
      <h1 className="mt-3 text-2xl font-bold">AI の相場予報</h1>
      {!feed ? (
        <p className={`${card} text-sm`}>予報の記録を読めませんでした (読み取りの鍵が無いか、台帳の書き出しがまだありません)。</p>
      ) : (
        <>
          <p className="text-sm text-text-tertiary">{md(feed.today.forecast_date)} の終値をもとにした予報 (毎朝 更新・書き出し {feed.generated_at})</p>
          <nav className="my-4 flex gap-2 text-sm">
            <a href="#today" className="flex-1 rounded-lg border border-border-primary p-2 text-center">今日の予報</a>
            <a href="#scores" className="flex-1 rounded-lg border border-border-primary p-2 text-center">成績</a>
          </nav>
          <Today feed={feed} />
          <Scores feed={feed} />
          <div className={`${card} text-xs leading-relaxed text-text-secondary`}>
            <b>「ふだん」とは？</b><br />
            このページの「ふだん」は、<b>過去の平均</b>です。今日の相場の予想ではありません。2 種類あります。<br />
            ・<b>ふだんの確率</b> (今日の予報): 2021 年 12 月〜2025 年 10 月の毎日 (約 1,300〜1,400 日) のうち、その問いの出来事が実際に起きた日の割合。数字は固定していて、毎日は変わりません。<br />
            ・<b>ふだんの割合</b> (サイクル予報): その指標の値がある全部の週 (多くは 2011 年ごろから) のうち、12 週後に BTC が上がっていた週の割合。<br />
            AI の確率が「ふだん」より高い・低いのは、「過去の平均と比べて、今日は起きやすい・起きにくいと見ている」という意味です。
            相場が変わると、「ふだん」そのものが今に合わなくなることがあります (成績で、実際に起きた割合と見比べてください)。<br /><br />
            <b>この記録について</b><br />
            予報は出した時のまま残し、外れも消していません。記録は行ごとに前の行の印をつないでいて、書き換えると印が合わなくなります。
            いまの記録: 予報 {feed.chain["forecasts.jsonl"]?.rows ?? "—"} 行・答え {feed.chain["resolutions.jsonl"]?.rows ?? "—"} 行・
            毎日の記録 {feed.chain["heartbeat.jsonl"]?.rows ?? "—"} 日分。<br /><br />
            <b>この予報が教えてくれないこと</b>: 上がるか下がるか・いくらになるか・いつ買うか売るか。確率は「ふだん」と比べて見るもので、売買の勧めではありません。
          </div>
        </>
      )}
    </main>
  );
}
