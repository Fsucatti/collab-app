// app/api/docs/[id]/revisions/[revId]/restore/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeDocHTML } from "@/lib/sanitize";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await ctx.params;

  const rev = await prisma.revision.findUnique({
    where: { id: revId },
    select: { id: true, documentId: true, content: true },
  });
  if (!rev || rev.documentId !== id) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const clean = sanitizeDocHTML(String(rev.content ?? ""));

  const updated = await prisma.document.update({
    where: { id },
    data: { content: clean },
    select: { id: true, content: true },
  });

  // Write a new revision representing the restore action
  await prisma.revision.create({
    data: { documentId: id, content: clean },
  });

  return NextResponse.json({ ok: true, content: updated.content });
}
