import createNextIntlPlugin from "next-intl/plugin";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Build-time injected version metadata.
//
// Surfaced to the UI via NEXT_PUBLIC_* env vars so the values are baked into
// the client bundle at build time. Vercel sets `VERCEL_GIT_COMMIT_SHA` on
// every deployment; we fall back to `git rev-parse` for local builds.
//
// Uses process.cwd() rather than import.meta.url because Next.js compiles
// next.config.ts to CJS internally and ESM `import.meta` is not available
// in that context. process.cwd() resolves to the project root in all
// environments where Next is invoked.
const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf-8")
) as { version: string };

function gitShortSha(): string {
  // Vercel preferred — set automatically in their build environment.
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "dev";
  }
}

const ARTICLE_LANE_REDIRECTS = [
  // W35 (Weekly Brief #4) は content/brief ではなく site-first 記事レーンが
  // 正本。/brief 側で一度公開し X 告知まで出したあとに気づいたため、外部に
  // 流通した旧 URL を記事へ 308 で送る。旧 URL を残すと同じ号が 2 URL で
  // 並び、号数も /brief 系列の連番 (#2) と食い違う。
  {
    from: "/brief/2026-W35-brief",
    to: "/articles/weekly-brief-20260829-4741307c",
  },
] as const;

const nextConfig = {
  async redirects() {
    return ARTICLE_LANE_REDIRECTS.flatMap(({ from, to }) => [
      // locale 付き (X 告知が指しているのはこちら)
      {
        source: `/:locale(ja|en)${from}`,
        destination: `/:locale${to}`,
        permanent: true,
      },
      // locale なし — proxy の /ja 付与を待たず 1 ホップで送る
      { source: from, destination: `/ja${to}`, permanent: true },
    ]);
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_SHA: gitShortSha(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
    // Deployment-stable clock anchor for server-rendered freshness values
    // (lib/deployment-freshness.ts). Baked once per build so ISR
    // regenerations of unchanged data render byte-identical output — Vercel
    // then skips the billed write (ISR cost doctrine, 2026-08-01).
    NEXT_PUBLIC_BUILD_TIME_MS: String(Date.now()),
  },
};

export default withNextIntl(nextConfig);
