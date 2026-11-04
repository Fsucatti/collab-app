// app/api/trash/[id]/restore/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocIdParam } from "@/lib/validation";
import { getCurrentUser } from "@/lib/permissions";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = DocIdParam.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const { id } = parsedParams.data;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.document.update({
    where: { id },
    data: { deletedAt: null },
  });

  return NextResponse.json({ ok: true });
}
