/**
 * POST /api/telegram/webhook
 *
 * Telegram calls this with each incoming update. We acknowledge fast (200)
 * and process the message. A secret token (set when registering the webhook)
 * is verified via the X-Telegram-Bot-Api-Secret-Token header.
 */

import type { NextRequest } from "next/server";
import { handleUpdate } from "@/lib/telegram/bot";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Verify the secret token if one is configured.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    await handleUpdate(update as Parameters<typeof handleUpdate>[0]);
  } catch (err) {
    console.error("[telegram] handleUpdate failed:", err);
  }

  // Always 200 so Telegram doesn't retry-storm us.
  return new Response("OK", { status: 200 });
}
