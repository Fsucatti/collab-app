// app/api/trash/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocIdParam } from "@/lib/validation";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const parsed = DocIdParam.safeParse(await ctx.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const { id } = parsed.data;

  // Ensure it exists and is actually in Trash
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.deletedAt) {
    return NextResponse.json({ error: "Document is not in Trash" }, { status: 409 });
  }

  // Hard delete (delete dependents first if you don't have cascading FKs)
  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { documentId: id } }),
    prisma.revision.deleteMany({ where: { documentId: id } }),
    prisma.document.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
