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

    return NextResponse.json({ status: "pending_confirmation" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
