import type { ForecastRow } from "@/lib/articles/article-model";

// 天気の言葉 → 記号と読み上げの言葉 (発行側は記号を送らない・2026-11-23 田平氏承認)
const WEATHER: Record<ForecastRow["weather"], { symbol: string; word: string }> = {
  sunny: { symbol: "☀", word: "晴れ" },
  cloudy: { symbol: "⛅", word: "くもり" },
  rain: { symbol: "☔", word: "雨" },
  missing: { symbol: "―", word: "欠測" },
};

function Row({ row }: { row: ForecastRow }) {
  const weather = WEATHER[row.weather];
  return (
    <li
      data-forecast-row=""
      data-scope={row.scope}
      className="flex flex-wrap items-baseline gap-x-2"
    >
      <span data-forecast-weather={row.weather} className="w-4 shrink-0 text-center">
        <span aria-hidden="true">{weather.symbol}</span>
        <span className="sr-only">{weather.word}</span>
      </span>
      <span data-forecast-label="" className="font-semibold text-text-primary">
        {row.label}
      </span>
      <span data-forecast-value="" className="ml-auto text-right tabular-nums">
        {row.value}
      </span>
    </li>
  );
}

/**
 * サイクル予報のカードの指標の表 (2026-11-23 田平氏承認)。天気・指標・今週の値の 3 つだけ
 * (根拠の割合は記事で読む)。並びは発行側 (= パネルの画像) のまま。ビットコインの行は天気の
 * 1 行の下にそのまま並べ、アルトシーズンの行だけ見出しを付ける。値が長ければ名前の下に折り返す。
 * 号の本文は日本語なので、見出しと読み上げの言葉も日本語 (天気の 1 行と同じ)。
 */
export function ForecastRowsTable({ rows }: { rows: ForecastRow[] }) {
  const btc = rows.filter((row) => row.scope === "btc");
  const alt = rows.filter((row) => row.scope === "altseason");
  return (
    <div data-forecast-rows="" className="mt-2 space-y-1 text-xs leading-relaxed text-text-secondary">
      {btc.length > 0 ? (
        <ul className="space-y-1">
          {btc.map((row, index) => (
            <Row key={`${row.scope}-${index}`} row={row} />
          ))}
        </ul>
      ) : null}
      {alt.length > 0 ? (
        <>
          <p data-forecast-scope-heading="" className="pt-1 font-bold text-text-primary">
            アルトシーズン
          </p>
          <ul className="space-y-1">
            {alt.map((row, index) => (
              <Row key={`${row.scope}-${index}`} row={row} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
