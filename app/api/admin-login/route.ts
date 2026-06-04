/**
 * POST /api/admin-login   body: { password }
 *   → sets the admin cookie on success
 * DELETE /api/admin-login  → logout (clears cookie)
 */

import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, gateDisabled, verifyPassword } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  if (gateDisabled()) {
    return Response.json({
      ok: true,
      note: "gate disabled (no ADMIN_PASSWORD)",
    });
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = await verifyPassword(body.password ?? "");
  if (!token) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
  return res;
}

export function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return res;
}
