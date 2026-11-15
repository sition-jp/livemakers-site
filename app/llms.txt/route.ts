import { buildLlmsTxt } from "@/lib/llms-txt";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return new Response(buildLlmsTxt(), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
