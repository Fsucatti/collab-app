// app/api/docs/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeDocHTML } from "@/lib/sanitize";
import { DocIdParam, UpsertDocBody, PatchDocBody } from "@/lib/validation";
import { Visibility } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ─────────────────────────────────────────────────────────
// limits
const MAX_DOC_HTML_CHARS = Number(process.env.MAX_DOC_HTML_CHARS ?? 400_000);

// very small in-memory rate limiter (per IP + route)
type Rate = { count: number; ts: number };
const RL = new Map<string, Rate>();
function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const r = RL.get(key) ?? { count: 0, ts: now };
  if (now - r.ts >= windowMs) { r.count = 0; r.ts = now; }
  r.count += 1;
  RL.set(key, r);
  return r.count <= max;
}
function ipFrom(req: Request) {
  return req.headers.get("x-forwarded-for") ?? "anon";
}

async function readJsonSafe(req: Request) {
  const text = await req.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Small helper to add no-cache on sensitive reads
function noCache(json: any, status = 200) {
  const res = NextResponse.json(json, { status });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

// ─────────────────────────────────────────────────────────
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const parsed = DocIdParam.safeParse(await ctx.params);
  if (!parsed.success) return noCache({ error: "Bad id" }, 400);
  const { id } = parsed.data;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      ownerId: true,
      visibility: true,
      deletedAt: true,
    },
  });

  if (!doc || doc.deletedAt) return noCache({ error: "Not found" }, 404);

  // Public docs are readable by anyone
  if (doc.visibility === Visibility.public) return noCache(doc);

  // Otherwise must be the owner
  if (!userId || doc.ownerId !== userId) return noCache({ error: "Forbidden" }, 403);

  return noCache(doc);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // simple write rate limit
  if (!allow(`ip:${ipFrom(req)}:docs:PUT`, 40, 10_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsedParams = DocIdParam.safeParse(await ctx.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const { id } = parsedParams.data;

  const body = await readJsonSafe(req);
  const parsedBody = UpsertDocBody.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  // bound input size (pre-sanitize)
  const incoming = parsedBody.data.content ?? "";
  if (incoming.length > MAX_DOC_HTML_CHARS) {
    return NextResponse.json({ error: "Content too large" }, { status: 413 });
  }

  const title = parsedBody.data.title ?? id;
  const cleanContent = sanitizeDocHTML(incoming);

  // bound stored size (post-sanitize)
  if (cleanContent.length > MAX_DOC_HTML_CHARS) {
    return NextResponse.json({ error: "Content too large after sanitize" }, { status: 413 });
  }

  // enforce ownership on upsert:
  const existing = await prisma.document.findUnique({ where: { id } });
  if (existing) {
    if (existing.deletedAt) {
      return NextResponse.json({ error: "Document is deleted" }, { status: 409 });
    }
    if (existing.ownerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const upserted = await prisma.document.upsert({
    where: { id },
    update: { title, content: cleanContent },
    create: { id, title, content: cleanContent, ownerId: userId },
  });

  await prisma.revision.create({
    data: { documentId: upserted.id, content: upserted.content },
  });

  return NextResponse.json(upserted);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // simple write rate limit
  if (!allow(`ip:${ipFrom(req)}:docs:PATCH`, 60, 10_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsedParams = DocIdParam.safeParse(await ctx.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const { id } = parsedParams.data;

  const body = await readJsonSafe(req);
  const parsedBody = PatchDocBody.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.deletedAt) return NextResponse.json({ error: "Document is deleted" }, { status: 409 });
  if (doc.ownerId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // bounds: pre-sanitize
  const incoming = parsedBody.data.content ?? "";
  if (incoming.length > MAX_DOC_HTML_CHARS) {
    return NextResponse.json({ error: "Content too large" }, { status: 413 });
  }

  // sanitize and bounds: post-sanitize
  const clean = sanitizeDocHTML(incoming);
  if (clean.length > MAX_DOC_HTML_CHARS) {
    return NextResponse.json({ error: "Content too large after sanitize" }, { status: 413 });
  }

  // safety brake against accidental wipe
  const isBlank = clean === "" || clean === "<p></p>" || clean === "<p></p>\n";
  const wasNonEmpty = !!doc.content && doc.content.replace(/\s+/g, "").length > 0;
  const allowEmpty = req.headers.get("x-allow-empty") === "true";
  if (isBlank && wasNonEmpty && !allowEmpty) {
    return NextResponse.json({ error: "Refusing to overwrite with empty content" }, { status: 409 });
  }

  // single update + revision
  await prisma.document.update({
    where: { id },
    data: { content: clean },
  });

  await prisma.revision.create({
    data: { documentId: id, content: clean },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allow(`ip:${ipFrom(req)}:docs:DELETE`, 20, 10_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsedParams = DocIdParam.safeParse(await ctx.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const { id } = parsedParams.data;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.ownerId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (doc.deletedAt) return NextResponse.json({ ok: true }); // idempotent

  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
