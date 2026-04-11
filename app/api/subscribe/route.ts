import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

const subscribeSchema = z.object({
  email: z.string().email(),
  locale: z.enum(["en", "ja"]).default("en"),
});

// Sender for welcome emails. Defaults to Resend's onboarding sandbox until
// the user verifies a custom domain (e.g. "LiveMakers <hello@livemakers.com>")
// in the Resend dashboard and sets RESEND_FROM. The sandbox sender is rate-
// limited and can only deliver to the Resend account owner's verified email,
// so production rollout requires the custom-domain step.
const WELCOME_FROM =
  process.env.RESEND_FROM ?? "LiveMakers <onboarding@resend.dev>";

function welcomeSubject(locale: "en" | "ja"): string {
  return locale === "ja"
    ? "LiveMakers 購読登録のご確認"
    : "Welcome to LiveMakers Weekly Brief";
}

function welcomeText(locale: "en" | "ja"): string {
  if (locale === "ja") {
    return [
      "LiveMakers Weekly Brief への購読登録ありがとうございます。",
      "",
      "Cardano と Midnight の週次インテリジェンスを毎週金曜 12:00 JST に",
      "https://livemakers.com/ja で公開しています。",
      "",
      "現在は登録のみで、メール配信機能の準備が整い次第、ご登録のアドレスへ",
      "Brief をお届けする予定です。準備ができ次第改めてお知らせします。",
      "",
      "登録解除はいつでもこちらから:",
      "https://livemakers.com/ja/subscribe",
      "",
      "— LiveMakers / SITION Group",
    ].join("\n");
  }
  return [
    "Thank you for subscribing to the LiveMakers Weekly Brief.",
    "",
    "We publish Cardano & Midnight institutional research every Friday 12:00 JST",
    "at https://livemakers.com/.",
    "",
    "Email delivery is being set up. Once it is ready, we will send each issue",
    "directly to this address. Until then, your subscription is recorded and",
    "you can read the Brief on the site.",
    "",
    "Unsubscribe at any time:",
    "https://livemakers.com/subscribe",
    "",
    "— LiveMakers / SITION Group",
  ].join("\n");
}

const rateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = rateLimit.get(ip) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) return false;
  rateLimit.set(ip, now);
  // Evict expired entries so the Map doesn't grow unboundedly on a warm server.
  for (const [k, v] of rateLimit) {
    if (now - v >= RATE_LIMIT_WINDOW_MS) rateLimit.delete(k);
  }
  return true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ status: "invalid_body" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_email" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ status: "not_configured" }, { status: 503 });
  }

  const resend = new Resend(apiKey);

  try {
    // Resend v6+ workspace-scoped contacts API: no audienceId needed.
    // Contacts live at workspace level; the implicit default audience is used.
    const result = await resend.contacts.create({
      email: parsed.data.email,
      unsubscribed: false,
    });

    if (result.error) {
      const msg = result.error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("exists")) {
        return NextResponse.json({ status: "already_subscribed" });
      }
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    // Best-effort welcome email. We do NOT block subscription success on this
    // — if the sender domain isn't verified yet, the contact is still saved
    // and we just log the failure for the operator to fix.
    try {
      const send = await resend.emails.send({
        from: WELCOME_FROM,
        to: parsed.data.email,
        subject: welcomeSubject(parsed.data.locale),
        text: welcomeText(parsed.data.locale),
      });
      if (send.error) {
        console.error(
          "[subscribe] welcome email failed:",
          send.error.message ?? send.error
        );
      }
    } catch (sendErr) {
      console.error("[subscribe] welcome email threw:", sendErr);
    }

    return NextResponse.json({ status: "pending_confirmation" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
