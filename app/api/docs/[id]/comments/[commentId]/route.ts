import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizePlainText } from "@/lib/sanitize";

const CommentPatch = z.object({
  // allow resolving toggles; extend later if you want to edit content
  resolved: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await ctx.params;

  const raw = await req.json().catch(() => null);
  const parsed = CommentPatch.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { resolved } = parsed.data;

  // if you later allow editing content/author, sanitize with sanitizeText()
  // and include those fields in the update data.
  



  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: {
      ...(typeof resolved === "boolean"
        ? {
            resolved,
            resolvedAt: resolved ? new Date() : null,
            resolvedBy: resolved ? null : null, // populate with user name if you wire auth
          }
        : {}),
    },
  });

  // ensure it's still for the same doc
  if (updated.documentId !== id) {
    // very defensive: undo or just forbid
    return NextResponse.json({ error: "Comment/document mismatch" }, { status: 400 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await ctx.params;

  // optional: verify it belongs to this doc first
  const existing = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!existing || existing.documentId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
