/**
 * static-params — build-time enumeration for generateStaticParams.
 *
 * ISR cost doctrine (2026-08-01): dynamic segments without
 * generateStaticParams are rendered on-demand per unique path, and every
 * render is a billed ISR write. These helpers enumerate the exact id/slug
 * sets the list surfaces link to, so detail pages prerender at build and
 * unknown paths 404 statically (dynamicParams = false) without invoking a
 * function.
 *
 * Contract: enumeration MUST match the list SSOT — intents are filtered to
 * visibility === "public" exactly like buildIntentListResponse.
 */
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  briefSlugParams,
  intentIdParams,
  signalIdParams,
  terminalAssetParams,
  turningPointAssetParams,
} from "@/lib/static-params";
import { getAllBriefs } from "@/lib/briefs";

const fixture = (rel: string) =>
  path.join(process.cwd(), "tests/fixtures", rel);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("briefSlugParams", () => {
  it("returns one {slug} per published brief, matching getAllBriefs", () => {
    const params = briefSlugParams();
    const slugs = getAllBriefs().map((b) => b.slug);
    expect(params).toEqual(slugs.map((slug) => ({ slug })));
    expect(params.length).toBeGreaterThan(0);
  });
});

describe("signalIdParams", () => {
  it("returns one {id} per collapsed signal in the jsonl", () => {
    vi.stubEnv("LM_SIGNALS_JSONL_PATH", fixture("signals/valid.jsonl"));
    const ids = signalIdParams().map((p) => p.id);
    expect(ids).toContain("sig_001");
    expect(ids).toContain("sig_005");
    // valid.jsonl has 8 lines with unique ids (reader collapses same-id rows).
    expect(ids).toHaveLength(8);
  });

  it("returns [] when the signals file is absent (pre-SDE state / Vercel)", () => {
    vi.stubEnv("LM_SIGNALS_JSONL_PATH", fixture("signals/does-not-exist.jsonl"));
    expect(signalIdParams()).toEqual([]);
  });
});

describe("intentIdParams", () => {
  it("returns only public intents (list SSOT symmetry)", () => {
    vi.stubEnv("LM_INTENTS_JSONL_PATH", fixture("intents/visibility-mix.jsonl"));
    const ids = intentIdParams().map((p) => p.id);
    expect(ids).toContain("int_0000000000000001");
    expect(ids).toContain("int_0000000000000002");
    expect(ids).not.toContain("int_0000000000000003"); // private
    expect(ids).toHaveLength(2);
  });

  it("returns [] when the intents file is absent", () => {
    vi.stubEnv("LM_INTENTS_JSONL_PATH", fixture("intents/does-not-exist.jsonl"));
    expect(intentIdParams()).toEqual([]);
  });
});

describe("terminalAssetParams", () => {
  it("enumerates the TerminalAsset enum as lowercase URL params", () => {
    expect(terminalAssetParams()).toEqual([
      { asset: "btc" },
      { asset: "eth" },
      { asset: "ada" },
      { asset: "night" },
    ]);
  });
});

describe("turningPointAssetParams", () => {
  it("enumerates the pivots AssetSymbol enum as lowercase URL params", () => {
    expect(turningPointAssetParams()).toEqual([
      { asset: "btc" },
      { asset: "eth" },
    ]);
  });
});
