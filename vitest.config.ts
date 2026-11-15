import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Per-file environment: component tests opt into jsdom via a
    // leading /* @vitest-environment jsdom */ docblock. Default stays
    // node for API / lib tests that shouldn't pay the jsdom startup cost.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx,mjs}"],
    setupFiles: ["./tests/setup.ts"],
    server: {
      deps: {
        // react-tweet は CSS Modules を含むため Node 直 import では
        // ".css" で落ちる。Vite に処理させる (inline)
        // next-intl の middleware は拡張子なしの "next/server" を import し、
        // Node 直 import では解決できない。tests/proxy.test.ts が本物の振り分けを
        // 通すため、middleware の部分だけ Vite に処理させる。
        inline: ["react-tweet", /next-intl[\\/]dist[\\/].*middleware/],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Next provides this marker at runtime. Vitest needs a resolvable no-op
      // module so jsdom tests can exercise the real server-side public loader.
      "server-only": path.resolve(
        __dirname,
        "./tests/fixtures/server-only.ts",
      ),
    },
  },
});
