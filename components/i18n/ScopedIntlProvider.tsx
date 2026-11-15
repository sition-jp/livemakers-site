import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";

import {
  pickClientMessages,
  type ClientMessageScope,
} from "@/lib/i18n/client-messages";

/**
 * ページ固有の client component に、その scope の翻訳だけを渡す
 * (lib/i18n/client-messages.ts)。root layout の provider は chrome 分しか
 * 持たないので、translations を使う client component はこれで包む。
 * 入れ子の provider は messages を差し替える (親とは merge しない) —
 * 同期 (useMessages) なので、同期の server component の中でも使える。
 * 包んだ内側の client component が使う namespace は全部 scope に入れること。
 */
export function ScopedIntlProvider({
  scope,
  children,
}: {
  scope: ClientMessageScope;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const messages = useMessages(); // server component でも使える (同期)
  return (
    <NextIntlClientProvider locale={locale} messages={pickClientMessages(messages, scope)}>
      {children}
    </NextIntlClientProvider>
  );
}
