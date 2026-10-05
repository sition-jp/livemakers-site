import { unstable_cache } from "next/cache";

/**
 * 出典ページの紹介画像とサイト名を取る (2026-10-05 設計書 source-link-cards §3)。
 * 相手サイトのタイトルは取らない — カードの文字は書き手が付けた出典名を使う。
 * 失敗はすべて「画像なし + ドメイン名」に倒す (記事表示を止めない)。
 *
 * キャッシュは unstable_cache で「解析後の { image, siteName }」だけを 1 日持つ。
 * fetch の next.revalidate はページ本文ごと Next のデータキャッシュに入れ、
 * 512KB 上限・3 秒の打ち切りも効かなくなるため使わない (unstable_cache の中の
 * fetch は no-store)。一時的な失敗は投げてキャッシュに残さず、外側で受けて
 * 代わりの表示に倒す。
 */
export type LinkPreview = { image: string | null; siteName: string };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** 通信エラー・時間切れ・5xx / 429。キャッシュに残さないために投げる。 */
export class TransientLinkPreviewError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TransientLinkPreviewError";
  }
}

const MAX_BYTES = 512 * 1024;
const MAX_SITE_NAME_CHARS = 80;
const TIMEOUT_MS = 3000;
const REVALIDATE_SECONDS = 86400;
const USER_AGENT = "Mozilla/5.0 (compatible; SITIONLinkPreview/1.0; +https://sition.jp)";
const HTML_TYPES = ["text/html", "application/xhtml+xml"];

export function isFetchableUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost") return false;
  if ([".localhost", ".local", ".internal"].some((suffix) => host.endsWith(suffix))) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  if (host.startsWith("[") || host.includes(":")) return false;
  return true;
}

export function siteNameFromUrl(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}

const META_RE = /<meta\b[^>]*>/gi;
const ATTR_RE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  amp: "&",
};
const ENTITY_RE = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|(quot|apos|lt|gt|amp));/g;

function fromCodePoint(code: number): string {
  const valid = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
  return valid ? String.fromCodePoint(code) : "\uFFFD";
}

/** 1 回の走査で解く (`&amp;#38;` を二重に解かない)。数値参照も Python の html.unescape と同じく解く。 */
export function decodeEntities(value: string): string {
  return value.replace(ENTITY_RE, (_, dec: string, hex: string, name: string) => {
    if (dec) return fromCodePoint(Number.parseInt(dec, 10));
    if (hex) return fromCodePoint(Number.parseInt(hex, 16));
    return NAMED_ENTITIES[name];
  });
}

function absoluteHttpsUrl(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseLinkPreview(html: string, pageUrl: string): LinkPreview {
  const meta = new Map<string, string>();
  for (const tag of html.match(META_RE) ?? []) {
    const attrs = new Map<string, string>();
    for (const m of tag.matchAll(ATTR_RE)) attrs.set(m[1].toLowerCase(), m[2] ?? m[3] ?? "");
    const key = (attrs.get("property") ?? attrs.get("name"))?.toLowerCase();
    const content = attrs.get("content");
    if (key && content !== undefined && !meta.has(key)) meta.set(key, decodeEntities(content.trim()));
  }
  return {
    image: absoluteHttpsUrl(meta.get("og:image") || meta.get("twitter:image"), pageUrl),
    siteName:
      Array.from(meta.get("og:site_name") ?? "")
        .slice(0, MAX_SITE_NAME_CHARS)
        .join("") || siteNameFromUrl(pageUrl),
  };
}

function charsetOf(contentType: string, head: Uint8Array): string {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  if (fromHeader) return fromHeader;
  const sniff = new TextDecoder("latin1").decode(head.subarray(0, 2048));
  return /charset\s*=\s*["']?([\w-]+)/i.exec(sniff)?.[1] ?? "utf-8";
}

async function readHead(res: Response, limit: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer()).subarray(0, limit);
  const reader = res.body.getReader();
  const out = new Uint8Array(limit);
  let filled = 0;
  while (filled < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const take = value.subarray(0, limit - filled);
    out.set(take, filled);
    filled += take.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return out.subarray(0, filled);
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function fallbackPreview(url: string): LinkPreview {
  return { image: null, siteName: siteNameFromUrl(url) };
}

/**
 * ページの先頭 MAX_BYTES を取って復号する (出典カードと PR TIMES 写真で共通)。
 * 決まった失敗は null、一時的な失敗は TransientLinkPreviewError を投げる。
 */
export async function loadHtmlHead(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ html: string; finalUrl: string } | null> {
  if (!isFetchableUrl(url)) return null;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new TransientLinkPreviewError(`link preview fetch failed: ${url}`, { cause: error });
  }
  if (res.status >= 500 || res.status === 429) {
    await res.body?.cancel().catch(() => undefined);
    throw new TransientLinkPreviewError(`link preview HTTP ${res.status}: ${url}`);
  }
  if (!res.ok) return null;
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!HTML_TYPES.some((type) => contentType.includes(type))) return null;
  let bytes: Uint8Array;
  try {
    bytes = await readHead(res, MAX_BYTES);
  } catch (error) {
    throw new TransientLinkPreviewError(`link preview body failed: ${url}`, { cause: error });
  }
  return { html: decode(bytes, charsetOf(contentType, bytes)), finalUrl: res.url || url };
}

/**
 * キャッシュされる中身。決まった結果 (og:image なし・404・HTML でない) は返し、
 * 一時的な失敗は TransientLinkPreviewError を投げる。
 */
export async function loadLinkPreview(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<LinkPreview> {
  const page = await loadHtmlHead(url, fetchImpl);
  return page ? parseLinkPreview(page.html, page.finalUrl) : fallbackPreview(url);
}

/** 投げた失敗 (= キャッシュに入らなかった失敗) を代わりの表示に倒す。 */
export function withFallback(
  load: (url: string) => Promise<LinkPreview>,
): (url: string) => Promise<LinkPreview> {
  return async (url) => {
    try {
      return await load(url);
    } catch {
      return fallbackPreview(url);
    }
  };
}

/** キャッシュなし・失敗は代わりの表示 (テストと単発の確認用)。 */
export async function fetchLinkPreview(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<LinkPreview> {
  return withFallback((target) => loadLinkPreview(target, fetchImpl))(url);
}

/** 描画用: 解析後の結果だけを 1 日キャッシュする (SourceCard が使う)。 */
export const getLinkPreview = withFallback(
  unstable_cache(async (url: string) => loadLinkPreview(url), ["link-preview"], {
    revalidate: REVALIDATE_SECONDS,
  }),
);
