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
        inline: ["react-tweet"],
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
