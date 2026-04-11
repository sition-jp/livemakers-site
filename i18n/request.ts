import { getRequestConfig } from "next-intl/server";

// Minimal stub — full config added in Task 7 (locale layout)
export default getRequestConfig(async ({ locale }) => ({
  locale: locale ?? "en",
  messages: {},
}));
