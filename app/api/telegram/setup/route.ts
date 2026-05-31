/**
 * Telegram webhook management.
 *
 * GET  /api/telegram/setup            → show current webhook info
 * POST /api/telegram/setup            → register the webhook
 *      body: { url: "https://your-public-domain/api/telegram/webhook" }
 * DELETE /api/telegram/setup          → remove the webhook
 *
 * NOTE: Telegram requires a PUBLIC https URL. On localhost, expose your dev
 * server with a tunnel first (e.g. `npx localtunnel --port 3000` or a
 * Cloudflare Tunnel), then POST that public URL here.
 */

import type { NextRequest } from "next/server";

const TG_API = "https://api.telegram.org";

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

export async function GET() {
  const t = token();
  if (!t) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 400 }
    );
  }
  const res = await fetch(`${TG_API}/bot${t}/getWebhookInfo`);
  return Response.json(await res.json());
}

export async function POST(req: NextRequest) {
  const t = token();
  if (!t) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 400 }
    );
  }
  const { url } = await req.json();
  if (!url) {
    return Response.json(
      { error: "url is required (your public /api/telegram/webhook URL)" },
      { status: 400 }
    );
  }

  const body: Record<string, unknown> = {
    url,
    allowed_updates: ["message"],
  };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    body.secret_token = secret;
  }

  const res = await fetch(`${TG_API}/bot${t}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return Response.json(await res.json());
}

export async function DELETE() {
  const t = token();
  if (!t) {
    return Response.json(
      { error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 400 }
    );
  }
  const res = await fetch(`${TG_API}/bot${t}/deleteWebhook`);
  return Response.json(await res.json());
}
