"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SearchIcon } from "@/components/search/SearchIcon";

/**
 * ヘッダー直下に開く横長の検索バー (2026-10-02 spec: モーダルにしない)。
 * GET form なので JS なしでも /{locale}/search?q= に移る。開いたら入力欄に focus、
 * Esc で閉じて 🔍 ボタンへ focus を戻す。
 */
export function SearchBar({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = () => {
    onClose();
    returnFocusRef?.current?.focus();
  };

  return (
    <div
      id="site-search"
      className="border-t border-border-primary px-4 py-3 sm:px-6"
    >
      <form
        role="search"
        method="get"
        action={`/${locale}/search`}
        aria-label={t("label")}
        className="mx-auto flex max-w-[960px] items-center gap-2"
      >
        <SearchIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          maxLength={100}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-sm border border-border-primary px-3 py-1 text-xs tracking-tabs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          {t("submit")}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="px-1 text-text-tertiary hover:text-text-primary"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </form>
    </div>
  );
}
