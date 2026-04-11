import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

const subscribeSchema = z.object({
  email: z.string().email(),
  locale: z.enum(["en", "ja"]).default("en"),
});

const rateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const last = rateLimit.get(ip) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) return false;
  rateLimit.set(ip, now);
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
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    return NextResponse.json({ status: "not_configured" }, { status: 503 });
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.contacts.create({
      email: parsed.data.email,
      audienceId,
      unsubscribed: false,
    });

    if (result.error) {
      const msg = result.error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("exists")) {
        return NextResponse.json({ status: "already_subscribed" });
      }
      return NextResponse.json({ status: "error" }, { status: 500 });
    }

    return NextResponse.json({ status: "pending_confirmation" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
