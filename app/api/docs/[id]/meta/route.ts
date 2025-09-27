// app/api/docs/[id]/meta/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitize";
import { z } from "zod";
import { Visibility } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DocIdParam = z.object({ id: z.string().min(1) });

const UpdateDocMeta = z.object({
  title: z.string().min(1).max(200).optional(),
  visibility: z.enum(["private","team","workspace","public"]).optional(),
}).refine(o => "title" in o || "visibility" in o, { message: "No changes provided" });

function toVisibilityEnum(v: string): Visibility | null {
  const norm = v.toLowerCase();
  // Map UI “team” to DB “workspace” if that's your enum name
  if (norm === "team") return (Visibility as any).workspace ?? Visibility.team ?? null;
  return (Visibility as any)[norm] ?? null;
}

async function readJsonSafe(req: Request) {
  const t = await req.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = DocIdParam.safeParse(await ctx.params);
  if (!parsedParams.success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const { id } = parsedParams.data;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership rule: if ownerId is null (pre-auth docs), let the first editor “claim” it.
  if (doc.ownerId && doc.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await readJsonSafe(req);
  const parsedBody = UpdateDocMeta.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const data: { title?: string; visibility?: Visibility; ownerId?: string | null } = {};
  if (typeof parsedBody.data.title === "string") {
    data.title = sanitizePlainText(parsedBody.data.title);
  }
  if (typeof parsedBody.data.visibility === "string") {
    const vis = toVisibilityEnum(parsedBody.data.visibility);
    if (!vis) return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    data.visibility = vis;
  }

  // Claim or preserve owner
  if (!doc.ownerId) data.ownerId = userId;
  
  
  
  const updated = await prisma.document.update({
    where: { id },
    data,
    select: { id: true, title: true, visibility: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}
