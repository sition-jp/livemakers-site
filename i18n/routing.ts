import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ja"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // Disable next-intl's built-in Accept-Language and cookie-based locale
  // detection. We want "/" to always serve EN regardless of the visitor's
  // browser language, and "/ja" to always serve JA. Users switch via the
  // explicit toggle in the header (which sets the cookie + hard-navigates).
  // With localeDetection: true (the default), even an empty middleware
  // would 307 first-time JA visitors away from "/" — which made the EN
  // homepage unreachable for them.
  localeDetection: false,
});
