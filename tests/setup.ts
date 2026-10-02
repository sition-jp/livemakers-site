import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import path from "node:path";
import { afterEach } from "vitest";

// 2026-10-02 (spec D13): 7/10 のレイアウト見本はテスト用フォルダにだけ置く
process.env.LIVEMAKERS_SESSIONS_FIXTURE_DIR ??= path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "sessions",
);

// Ensure the jsdom DOM tree is reset between tests so successive render()
// calls don't accumulate. Vitest + Testing Library don't auto-cleanup in
// this setup pattern.
afterEach(() => {
  cleanup();
});
