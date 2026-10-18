import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleAnalytics } from "@/components/layout/GoogleAnalytics";
import {
  GA_MEASUREMENT_ID,
  gaInitSnippet,
  shouldLoadAnalytics,
} from "@/lib/analytics";
import ja from "@/messages/ja.json";
import en from "@/messages/en.json";

describe("GA4 tag (2026-10-19)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the LiveMakers property's measurement ID", () => {
    expect(GA_MEASUREMENT_ID).toBe("G-437J767WN7");
  });

  it("loads only on Vercel production", () => {
    expect(shouldLoadAnalytics("production")).toBe(true);
    expect(shouldLoadAnalytics("preview")).toBe(false);
    expect(shouldLoadAnalytics("development")).toBe(false);
    expect(shouldLoadAnalytics(undefined)).toBe(false);
  });

  it("renders nothing outside production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(GoogleAnalytics()).toBeNull();
  });

  it("renders the gtag scripts on production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(GoogleAnalytics()).not.toBeNull();
  });

  it("configures gtag with the measurement ID", () => {
    expect(gaInitSnippet(GA_MEASUREMENT_ID)).toContain(
      "gtag('config','G-437J767WN7')",
    );
  });

  it("privacy policy discloses Google Analytics in both locales", () => {
    expect(ja.privacy.analyticsBody).toContain("Google Analytics");
    expect(en.privacy.analyticsBody).toContain("Google Analytics");
    expect(ja.privacy.analyticsBody).not.toContain("導入していません");
    expect(en.privacy.analyticsBody).not.toContain("We do not use analytics");
  });
});
