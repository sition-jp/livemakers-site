"use client";

import { useEffect, useState } from "react";

import { isChromeData, type ChromeData } from "@/lib/layout/chrome-data";

export const CHROME_ENDPOINT = "/api/chrome";

// 画面遷移 (クライアント側のページ移動) のたびに取り直さないよう、1 回分を共有する
let pending: Promise<ChromeData | null> | null = null;

function loadChromeData(): Promise<ChromeData | null> {
  pending ??= fetch(CHROME_ENDPOINT)
    .then((response) => (response.ok ? response.json() : null))
    .then((data: unknown) => (isChromeData(data) ? data : null))
    .catch(() => null)
    .then((data) => {
      if (!data) pending = null;
      return data;
    });
  return pending;
}

/** テスト用: 共有している取得結果を捨てる */
export function resetChromeDataForTest(): void {
  pending = null;
}

/**
 * 全ページ共通の枠の中身をブラウザで読む (2026-11-20・Vercel ISR Writes 削減)。
 * 読めるまでは null (枠は高さだけ確保した空の帯で描く)。
 */
export function useChromeData(): ChromeData | null {
  const [data, setData] = useState<ChromeData | null>(null);
  useEffect(() => {
    let active = true;
    loadChromeData().then((loaded) => {
      if (active) setData(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return data;
}
