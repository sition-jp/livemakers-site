// 相場の状態 (長期 / 1〜3 か月 / 足元) の見出し・札・暴落の 1 文 (TP 表示 v2・Task 9)。
// 文は作らない: 文言の鍵と値を返し、部品が useTranslations("turningPoints.v2") で文にする
// (forecast.ts と同じ分け方)。% は符号付き整数 (記号 % は文言側)・価格は formatPrice。
// 日付は ISO のまま返すものと、月・日の数だけ返すものがある (名前に Month / Day が付くもの)。
import { formatPrice } from "./forecast";
import type { Regime } from "./types";

export type RegimeOne = NonNullable<Regime[keyof Regime]>;
type LongBlock = NonNullable<RegimeOne["long"]>;
type LongKey = LongBlock["state"] | "none";
type NearKind = "up" | "flat" | "down";

export type LayerId = "long" | "mid" | "near";
export type Part = { key: string; values: Record<string, string | number> };
export type Chip = { label: Part; value: Part; note: Part };

/** 10 回に N 回くらい (27 → 3・18 → 2)。 */
export function tenScale(pct: number): number {
  return Math.round(pct / 10);
}

/** 整数に丸めた符号付きの % の数 (記号 % は付けない)。マイナスは U+2212・0 は「±0」。 */
export function signedIntPct(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "±0";
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

function longKey(r: RegimeOne): LongKey {
  return r.long ? r.long.state : "none";
}

function monthDay(iso: string): { m: number; d: number } {
  const [, m, d] = iso.split("-").map(Number);
  return { m, d };
}

function thirtyKind(long: LongBlock["state"], near: NearKind): string {
  if (near === "flat") return "flat";
  if (long === "down") return near === "up" ? "rebound" : "also_down";
  if (long === "up") return near === "up" ? "also_up" : "down";
  return near; // recovering: 同じ向きでも「は」
}

export function headlineParts(r: RegimeOne, layer: LayerId): Part[] {
  if (layer === "long") {
    const near = r.near;
    if (!r.long) {
      if (!near) return [];
      return [
        {
          key: `headline.near_only.${near.state}`,
          values: { pct: signedIntPct(near.ret_30d_pct ?? 0) },
        },
      ];
    }
    const parts: Part[] = [{ key: `headline.flow.${r.long.state}`, values: {} }];
    if (near) {
      parts.push({
        key: `headline.thirty.${thirtyKind(r.long.state, near.state)}`,
        values: { pct: signedIntPct(near.ret_30d_pct ?? 0) },
      });
    }
    return parts;
  }
  if (layer === "mid") {
    const mid = r.mid;
    if (!mid) return [];
    const parts: Part[] = [{ key: "headline.mid.state", values: { state: mid.state } }];
    if (mid.state === "crash" || mid.state === "surge") {
      parts.push({ key: "headline.mid.shock", values: { state: mid.state, days: mid.days } });
    } else {
      parts.push({
        key: "headline.mid.note",
        values: { long: longKey(r), state: mid.state, days: mid.days },
      });
    }
    return parts;
  }
  const near = r.near;
  if (!near) return [];
  const parts: Part[] = [
    {
      key: "headline.near.sentence",
      values: { kind: near.state, pct: signedIntPct(near.ret_30d_pct ?? 0) },
    },
  ];
  if (near.close_30d_ago !== undefined) {
    parts.push({
      key: "headline.near.from_to",
      values: { from: formatPrice(near.close_30d_ago), to: formatPrice(near.close) },
    });
  }
  return parts;
}

function longChip(l: LongBlock): Chip {
  const since = monthDay(l.since_week);
  let note: Part;
  if (l.state === "down") {
    const base = {
      ath: formatPrice(l.ath.close),
      athDate: l.ath.date,
      sinceMonth: since.m,
      sinceDay: since.d,
    };
    note =
      l.ath.pct_from_ath >= 0
        ? { key: "chip.note.long.down_newhigh", values: base }
        : { key: "chip.note.long.down", values: { ...base, pct: signedIntPct(l.ath.pct_from_ath) } };
  } else if (l.state === "up") {
    note = { key: "chip.note.long.up", values: { sinceMonth: since.m, sinceDay: since.d } };
  } else if (l.trough) {
    note = {
      key: "chip.note.long.recovering",
      values: { troughMonth: monthDay(l.trough.week).m, w100: formatPrice(l.w100) },
    };
  } else {
    note = { key: "chip.note.long.recovering_notrough", values: { w100: formatPrice(l.w100) } };
  }
  return {
    label: { key: "chip.label.long", values: {} },
    value: { key: `chip.value.long.${l.state}`, values: {} },
    note,
  };
}

export function chipParts(r: RegimeOne): Record<LayerId, Chip | null> {
  const mid: Chip | null = r.mid
    ? {
        label: { key: "chip.label.mid", values: {} },
        value: { key: `chip.value.mid.${r.mid.state}`, values: {} },
        note: { key: `chip.mid.${longKey(r)}.${r.mid.state}`, values: { days: r.mid.days } },
      }
    : null;
  const near: Chip | null = r.near
    ? {
        label: { key: "chip.label.near", values: {} },
        value: {
          key: `chip.value.near.${r.near.state}`,
          values: { pct: signedIntPct(r.near.ret_30d_pct ?? 0) },
        },
        note: {
          key: "chip.note.near",
          values: {
            from: r.near.close_30d_ago !== undefined ? formatPrice(r.near.close_30d_ago) : "",
            to: formatPrice(r.near.close),
            days: r.near.days,
          },
        },
      }
    : null;
  return { long: r.long ? longChip(r.long) : null, mid, near };
}

/** 暴落・急騰の日の「過去の回数」の 1 文 (n ≥ 10 / 5〜9 / 0〜4)。long は起点の日の長期の状態。 */
export function shockParts(r: RegimeOne): Part | null {
  const s = r.shock;
  if (!s || (r.mid?.state !== "crash" && r.mid?.state !== "surge")) return null;
  const key = s.n >= 10 ? "shock.many" : s.n >= 5 ? "shock.few" : "shock.none";
  return {
    key,
    values: {
      kind: s.kind,
      long: s.long_state,
      n: s.n,
      newExtreme: s.new_extreme_30d,
      higher: s.higher_30d,
    },
  };
}

/** 一覧の全体の 1 行。assets は "BTC,ETH" のようにコンマ区切り (文言側で「BTC も ETH も」に整える)。 */
export function overviewParts(byAsset: Partial<Record<string, RegimeOne>>): Part[] {
  const entries = Object.entries(byAsset).filter((e): e is [string, RegimeOne] => !!e[1]);
  const parts: Part[] = [];

  const longs = entries.filter(([, r]) => r.long);
  if (longs.length > 0) {
    const states = new Set(longs.map(([, r]) => r.long!.state));
    if (longs.length > 1 && states.size === 1) {
      parts.push({
        key: "overview.long.same",
        values: { assets: longs.map(([a]) => a).join(","), state: longs[0][1].long!.state },
      });
    } else {
      for (const [a, r] of longs) {
        parts.push({ key: "overview.long.each", values: { asset: a, state: r.long!.state } });
      }
    }
  }

  const nears = entries.filter(([, r]) => r.near);
  if (nears.length > 0) {
    const kinds = new Set(nears.map(([, r]) => r.near!.state));
    if (nears.length > 1 && kinds.size === 1) {
      parts.push({ key: "overview.near.same", values: { kind: nears[0][1].near!.state } });
    } else {
      for (const [a, r] of nears) {
        parts.push({ key: "overview.near.each", values: { asset: a, kind: r.near!.state } });
      }
    }
  }
  return parts;
}
