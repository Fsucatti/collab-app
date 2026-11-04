import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizePlainText } from "@/lib/sanitize";
import { denied, getCurrentUser, getDocAccess, type CurrentUser } from "@/lib/permissions";

const CommentPatch = z.object({
  // allow resolving toggles; extend later if you want to edit content
  resolved: z.boolean().optional(),
});

/** Only the document owner can resolve or delete comments. */
async function authorize(id: string, commentId: string) {
  const user = await getCurrentUser();
  const access = await getDocAccess(id, user?.id ?? null);
  if (!user || !access.isOwner) {
    return { error: denied(access, user?.id ?? null) };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { documentId: true },
  });
  if (!comment || comment.documentId !== id) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { user: user as CurrentUser };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await ctx.params;
  const auth = await authorize(id, commentId);
  if (auth.error) return auth.error;

  const raw = await req.json().catch(() => null);
  const parsed = CommentPatch.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { resolved } = parsed.data;

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: {
      ...(typeof resolved === "boolean"
        ? {
            resolved,
            resolvedAt: resolved ? new Date() : null,
            resolvedBy: resolved ? sanitizePlainText(auth.user.name).slice(0, 120) : null,
          }
        : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await ctx.params;
  const auth = await authorize(id, commentId);
  if (auth.error) return auth.error;

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
