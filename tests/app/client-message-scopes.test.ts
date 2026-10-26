import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import {
  CLIENT_MESSAGE_SCOPES,
  type ClientMessageScope,
} from "@/lib/i18n/client-messages";

/**
 * client に渡す翻訳辞書の渡し漏れ検査 (ISR コスト doctrine・2026-10-26)。
 *
 * root layout は chrome scope の辞書しか client に渡さない。client bundle に
 * 入るモジュールが useTranslations("x") で使う namespace は、その client
 * component を描く server file (layout なら chrome・それ以外は
 * <ScopedIntlProvider scope="..."> の scope) に含まれていなければならない。
 * 漏れると本番で MISSING_MESSAGE になり、文言がキー名のまま出る。
 *
 * 静的解析の限界: server file 内で ScopedIntlProvider の外側に描いた場合は
 * 検出できない (scope 名の有無を file 単位で見る)。
 */

const ROOT = path.resolve(__dirname, "../..");
const EXTS = [".tsx", ".ts", ".jsx", ".js"];
const LAYOUT = path.join(ROOT, "app/[locale]/layout.tsx");

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTS.includes(path.extname(full)) && !/\.test\./.test(full)) {
      out.push(full);
    }
  }
}

const files: string[] = [];
for (const dir of ["app", "components", "hooks", "lib"]) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) walk(full, files);
}
const source = new Map(files.map((file) => [file, fs.readFileSync(file, "utf8")]));

const isClient = (text: string) =>
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(text);

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;
  const candidates = [
    base,
    ...EXTS.map((ext) => base + ext),
    ...EXTS.map((ext) => path.join(base, `index${ext}`)),
  ];
  return candidates.find((candidate) => source.has(candidate)) ?? null;
}

function importsOf(file: string): string[] {
  const text = source.get(file)!;
  const found: string[] = [];
  // `import type` は消えるので client bundle に入らない
  for (const match of text.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[\s\S]*?\s+from\s+["']([^"']+)["']/g,
  )) {
    const resolved = resolveImport(file, match[1]);
    if (resolved) found.push(resolved);
  }
  for (const match of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) {
    const resolved = resolveImport(file, match[1]);
    if (resolved) found.push(resolved);
  }
  return found;
}

function namespacesOf(file: string): string[] {
  const text = source.get(file)!;
  return [
    ...text.matchAll(/use(?:Translations|Messages)\(\s*(?:["']([^"']*)["'])?\s*\)/g),
  ].map((match) => match[1] ?? "<ALL>");
}

/** client module から辿れる全モジュールが使う namespace。 */
function clientNamespaces(root: string): Set<string> {
  const seen = new Set<string>();
  const stack = [root];
  const used = new Set<string>();
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const namespace of namespacesOf(file)) used.add(namespace);
    stack.push(...importsOf(file));
  }
  return used;
}

function covered(namespace: string, allowed: readonly string[]): boolean {
  return allowed.some(
    (scope) => namespace === scope || namespace.startsWith(`${scope}.`),
  );
}

function scopesDeclaredIn(file: string): ClientMessageScope[] {
  if (file === LAYOUT) return ["chrome"];
  const text = source.get(file)!;
  return [...text.matchAll(/<ScopedIntlProvider\s+scope="([a-zA-Z]+)"/g)].map(
    (match) => match[1] as ClientMessageScope,
  );
}

// client 境界 = server file から直接 import される client module
const boundaries: { server: string; client: string }[] = [];
for (const file of files) {
  if (isClient(source.get(file)!)) continue;
  for (const imported of importsOf(file)) {
    if (isClient(source.get(imported)!)) {
      boundaries.push({ server: file, client: imported });
    }
  }
}

describe("client message scopes", () => {
  it("finds the client boundaries (sanity)", () => {
    const clients = boundaries.map(({ client }) => path.relative(ROOT, client));
    expect(clients).toContain("components/layout/SiteChrome.tsx");
    expect(clients).toContain("components/terminal/SignalsFeed.tsx");
  });

  it("every translated client component is rendered inside a scope that carries its namespaces", () => {
    const problems: string[] = [];
    for (const { server, client } of boundaries) {
      const used = [...clientNamespaces(client)];
      if (used.length === 0) continue;
      const scopes = scopesDeclaredIn(server);
      const allowed = scopes.flatMap((scope) => CLIENT_MESSAGE_SCOPES[scope] ?? []);
      const missing = used.filter((namespace) => !covered(namespace, allowed));
      if (missing.length > 0) {
        problems.push(
          `${path.relative(ROOT, server)} → ${path.relative(ROOT, client)}: ` +
            `missing ${missing.join(", ")} (scopes: ${scopes.join(", ") || "none"})`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("every scope namespace exists in both locales", () => {
    const has = (messages: unknown, namespace: string) =>
      namespace.split(".").reduce<unknown>(
        (node, key) =>
          node !== null && typeof node === "object"
            ? (node as Record<string, unknown>)[key]
            : undefined,
        messages,
      ) !== undefined;
    for (const namespaces of Object.values(CLIENT_MESSAGE_SCOPES)) {
      for (const namespace of namespaces) {
        expect(has(ja, namespace), `ja ${namespace}`).toBe(true);
        expect(has(en, namespace), `en ${namespace}`).toBe(true);
      }
    }
  });
});
