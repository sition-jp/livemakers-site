import type { AbstractIntlMessages } from "next-intl";

/**
 * client に渡す翻訳辞書の範囲 (ISR コスト doctrine・2026-10-26 田平氏 GO)。
 *
 * 以前は root layout が messages/<locale>.json 全体 (~57KB) を
 * NextIntlClientProvider に渡しており、全ページの HTML と RSC payload に
 * 同じ辞書が焼き込まれていた。ISR Writes は書き込んだ bytes (8KB 単位) で
 * 課金されるため、1 回の再生成の書込量の 4 割前後が辞書だった
 * (/ja/about 実測: HTML 150KB 中 57KB)。
 *
 * server component は getTranslations / useTranslations で request config の
 * 全辞書を読めるので、client に渡すのは client component が使う namespace
 * だけでよい。
 * - chrome = root layout の SiteChrome (Header / Footer / 来歴帯) が使う分。
 *   全ページに載るので最小に保つ
 * - それ以外 = その client component を描くページだけが ScopedIntlProvider で
 *   追加で渡す
 *
 * 渡し漏れは tests/app/client-message-scopes.test.ts が静的に検出する
 * (client component の useTranslations("x") が、描画元の scope に無いと fail)。
 */
export const CLIENT_MESSAGE_SCOPES = {
  chrome: ["nav", "footer", "follow", "search", "home.provenance"],
  signals: ["signals"],
  intents: ["intents"],
  assets: ["assets"],
  subscribe: ["subscribe"],
} as const satisfies Record<string, readonly string[]>;

export type ClientMessageScope = keyof typeof CLIENT_MESSAGE_SCOPES;

/**
 * messages から namespace (ドット区切り可) の部分木だけを抜き出す。
 * 元の messages は変更しない。存在しない namespace は黙って飛ばす
 * (en/ja の片方にしか無いキーで落とさない — 実際の欠落は描画側の
 * MISSING_MESSAGE と既存の辞書テストが拾う)。
 */
export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const namespace of namespaces) {
    const keys = namespace.split(".");
    let source: unknown = messages;
    for (const key of keys) {
      source =
        source !== null && typeof source === "object"
          ? (source as Record<string, unknown>)[key]
          : undefined;
    }
    if (source === undefined) continue;
    let target = picked as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) {
      // 中間ノードは毎回作り直す — 元 messages の object を共有して書き換えない
      const existing = target[key];
      target[key] =
        existing !== null && typeof existing === "object"
          ? { ...(existing as Record<string, unknown>) }
          : {};
      target = target[key] as Record<string, unknown>;
    }
    target[keys[keys.length - 1]] = source;
  }
  return picked;
}

export function pickClientMessages(
  messages: AbstractIntlMessages,
  scope: ClientMessageScope,
): AbstractIntlMessages {
  return pickMessages(messages, CLIENT_MESSAGE_SCOPES[scope]);
}
