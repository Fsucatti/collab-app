//realtime\token\route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// shared secret with the realtime server
const SECRET = process.env.REALTIME_HMAC_SECRET || "dev-secret-change-me";

// tiny helpers
function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function hmacSHA256(msg: string, secret: string) {
  const crypto = await import("node:crypto");
  return crypto.createHmac("sha256", secret).update(msg).digest("base64url");
}

// POST is nicer for docId
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  // body: { docId?: string, intent?: "edit" | "view" }
  const json = await req.json().catch(() => ({} as any));
  const docId = typeof json.docId === "string" ? json.docId : undefined;
  const intent = json.intent === "edit" ? "edit" : "view";

  // unauthenticated users can only get a viewer token (for presence + watching)
  if (!userId && intent === "edit") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If asking for edit, verify ownership of that doc
  if (intent === "edit" && docId) {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { ownerId: true },
    });
    if (!doc || doc.ownerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const payload = {
    sub: userId ?? "viewer",      // who
    name: session?.user?.name ?? (userId ? "User" : "Viewer"),
    iat: Date.now(),
    exp: Date.now() + 5 * 60 * 1000,  // 5 min
    scope: "realtime",
    role: intent,                  // "view" | "edit"
    docId: docId ?? null,          // editors: bound to a specific doc
  };

  const body = b64url(JSON.stringify(payload));
  const sig = await hmacSHA256(body, SECRET);
  return NextResponse.json({ token: `${body}.${sig}` });
}

// ALSO keep a GET for anonymous viewer tokens if you want:
export async function GET() {
  // anonymous viewer token (no doc binding; role=view)
  const payload = {
    sub: "anon",
    name: "Viewer",
    iat: Date.now(),
    exp: Date.now() + 5 * 60 * 1000,
    scope: "realtime",
    role: "view",
    docId: null,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = await hmacSHA256(body, SECRET);
  return NextResponse.json({ token: `${body}.${sig}` });
}
