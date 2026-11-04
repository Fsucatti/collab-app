// app/api/realtime/token/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, getDocAccess, denied } from "@/lib/permissions";

export const runtime = "nodejs";

// Shared with the realtime server. Production must never fall back to a known value.
function getSecret() {
  const secret = process.env.REALTIME_HMAC_SECRET;
  if (secret) return secret;
  return process.env.NODE_ENV === "production" ? null : "dev-secret-change-me";
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function hmacSHA256(msg: string, secret: string) {
  const crypto = await import("node:crypto");
  return crypto.createHmac("sha256", secret).update(msg).digest("base64url");
}

// Every token is bound to one document the caller has already been checked against.
// body: { docId: string, intent?: "edit" | "view" }
export async function POST(req: Request) {
  const secret = getSecret();
  if (!secret) return NextResponse.json({ error: "Realtime is not configured" }, { status: 500 });

  const json = await req.json().catch(() => ({} as any));
  const docId = typeof json.docId === "string" && json.docId ? json.docId : null;
  if (!docId) return NextResponse.json({ error: "docId is required" }, { status: 400 });
  const intent = json.intent === "edit" ? "edit" : "view";

  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const access = await getDocAccess(docId, userId);
  const allowed = intent === "edit" ? access.canEdit : access.canRead;
  if (!allowed) return denied(access, userId);

  const { randomUUID } = await import("node:crypto");
  const payload = {
    sub: userId ?? `anon-${randomUUID().slice(0, 8)}`,
    name: user?.name ?? "Viewer",
    iat: Date.now(),
    exp: Date.now() + 5 * 60 * 1000, // 5 min; the client asks for a new one on each connection
    scope: "realtime",
    role: intent,
    docId,
  };

  const body = b64url(JSON.stringify(payload));
  const sig = await hmacSHA256(body, secret);
  return NextResponse.json({ token: `${body}.${sig}` });
}
