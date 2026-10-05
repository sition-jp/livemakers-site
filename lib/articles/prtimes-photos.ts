import { unstable_cache } from "next/cache";

import {
  decodeEntities,
  loadHtmlHead,
  type FetchLike,
} from "@/lib/articles/link-preview";
import defaultBlocklist from "@/lib/articles/prtimes-photo-blocklist.json";

/**
 * PR TIMES リリースの写真を選ぶ (2026-10-06 設計書 prtimes-press-photos §3)。
 * 書き手が確認した印 (#sition-photos) 付きのリリースだけが対象。SDE の
 * auto_publisher/prtimes_photos.py と同じ規則。
 */
export const PRTIMES_PHOTOS_MARKER = "sition-photos";
export const MAX_PRESS_PHOTOS = 3;
const MAX_COMPANY_CHARS = 80;
const REVALIDATE_SECONDS = 86400;
const CDN = "https://prcdn.freetls.fastly.net/release_image/";
const DISPLAY_QUERY = "?format=jpeg&auto=webp&fit=bounds&width=1200&height=1200";
const RELEASE_PATH_RE = /^\/main\/html\/rd\/p\/(\d+)\.(\d+)\.html$/;
const IMAGE_RE = /https:\/\/prcdn\.freetls\.fastly\.net\/release_image\/(\d+)\/(\d+)\/([A-Za-z0-9._-]+)/g;
const DIMS_RE = /-(\d{1,5})x(\d{1,5})\.\w+$/;

export type PrtimesRelease = {
  releaseUrl: string;
  releaseId: string;
  releaseNo: string;
  companyNo: string;
};

export type PressPhotos = { releaseUrl: string; company: string; images: string[] };

const stripZeros = (digits: string) => digits.replace(/^0+/, "") || "0";

export function parseMarkedRelease(raw: string): PrtimesRelease | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.host !== "prtimes.jp" || url.search) return null;
  if (url.hash !== `#${PRTIMES_PHOTOS_MARKER}`) return null;
  const m = RELEASE_PATH_RE.exec(url.pathname);
  if (!m) return null;
  return {
    releaseUrl: `https://prtimes.jp${url.pathname}`,
    releaseId: `${m[1]}.${m[2]}`,
    releaseNo: stripZeros(m[1]),
    companyNo: stripZeros(m[2]),
  };
}

export function selectPressPhotos(html: string, release: PrtimesRelease): string[] {
  const seen = new Set<string>();
  const photos: string[] = [];
  for (const [, company, number, filename] of html.matchAll(IMAGE_RE)) {
    if (stripZeros(company) !== release.companyNo || stripZeros(number) !== release.releaseNo) continue;
    const key = filename.replace(DIMS_RE, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const dims = DIMS_RE.exec(filename);
    if (dims) {
      const width = Number(dims[1]);
      const height = Number(dims[2]);
      if (width < 400 || height < 300 || width / height < 0.5 || width / height > 2.5) continue;
    }
    photos.push(`${CDN}${company}/${number}/${filename}${DISPLAY_QUERY}`);
    if (photos.length >= MAX_PRESS_PHOTOS) break;
  }
  return photos;
}

function capChars(value: string): string {
  return Array.from(value).slice(0, MAX_COMPANY_CHARS).join("");
}

function ldOrganizationName(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const name = ldOrganizationName(item);
      if (name) return name;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if ((record["@type"] === "Organization" || record["@type"] === "Corporation") && typeof record.name === "string") {
      return record.name;
    }
    for (const value of Object.values(record)) {
      const name = ldOrganizationName(value);
      if (name) return name;
    }
  }
  return null;
}

/** 表示できないリリース (印なし・取り下げ) か。キャッシュの外で判定する (取り下げはデプロイで即効)。 */
export function isBlockedRelease(url: string, blocklist: readonly string[] = defaultBlocklist): boolean {
  const release = parseMarkedRelease(url);
  return !release || blocklist.includes(release.releaseId);
}

export function pressCompanyName(html: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (title) {
    // decodeEntities は &quot; &#39; &lt; &gt; &amp; と数値参照だけ (Python の html.unescape より狭い・許容済み)
    const company = /^.*\|\s*(.+?)のプレスリリース\s*$/.exec(decodeEntities(title.replace(/\s+/g, " ")).trim())?.[1];
    if (company) return capChars(company.trim());
  }
  for (const [, block] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const name = ldOrganizationName(JSON.parse(block));
      if (name) return capChars(name.trim());
    } catch {
      // 壊れた JSON-LD は飛ばす
    }
  }
  return "発表企業";
}

/** キャッシュされる中身。対象外・取り下げ・決まった失敗は null、一時的な失敗は投げる。 */
export async function loadPressPhotos(
  url: string,
  fetchImpl: FetchLike = fetch,
  blocklist: readonly string[] = defaultBlocklist,
): Promise<PressPhotos | null> {
  if (isBlockedRelease(url, blocklist)) return null;
  const release = parseMarkedRelease(url)!;
  const page = await loadHtmlHead(release.releaseUrl, fetchImpl);
  if (!page) return null;
  return {
    releaseUrl: release.releaseUrl,
    company: pressCompanyName(page.html),
    images: selectPressPhotos(page.html, release),
  };
}

const cachedLoad = unstable_cache(async (url: string) => loadPressPhotos(url), ["prtimes-photos"], {
  revalidate: REVALIDATE_SECONDS,
});

/** 描画用: 解析結果だけを 1 日キャッシュ。一時的な失敗はキャッシュせず null。 */
export async function getPressPhotos(url: string): Promise<PressPhotos | null> {
  if (isBlockedRelease(url)) return null;
  try {
    return await cachedLoad(url);
  } catch {
    return null;
  }
}
