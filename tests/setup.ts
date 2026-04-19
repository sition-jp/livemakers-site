import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Ensure the jsdom DOM tree is reset between tests so successive render()
// calls don't accumulate. Vitest + Testing Library don't auto-cleanup in
// this setup pattern.
afterEach(() => {
  cleanup();
});
