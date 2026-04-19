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
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
