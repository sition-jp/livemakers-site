/**
 * 出典ページの紹介画像とサイト名を取る (2026-10-05 設計書 source-link-cards §3)。
 * 相手サイトのタイトルは取らない — カードの文字は書き手が付けた出典名を使う。
 * 失敗はすべて「画像なし + ドメイン名」に倒す (記事表示を止めない)。
 */
export type LinkPreview = { image: string | null; siteName: string };

export type FetchLike = (
  input: string,
  init?: RequestInit & { next?: { revalidate?: number } },
) => Promise<Response>;

const MAX_BYTES = 512 * 1024;
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

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
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
    siteName: meta.get("og:site_name") || siteNameFromUrl(pageUrl),
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

export async function fetchLinkPreview(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<LinkPreview> {
  const fallback: LinkPreview = { image: null, siteName: siteNameFromUrl(url) };
  if (!isFetchableUrl(url)) return fallback;
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return fallback;
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!HTML_TYPES.some((type) => contentType.includes(type))) return fallback;
    const bytes = await readHead(res, MAX_BYTES);
    return parseLinkPreview(decode(bytes, charsetOf(contentType, bytes)), res.url || url);
  } catch {
    return fallback;
  }
}
