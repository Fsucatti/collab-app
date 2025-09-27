// app/api/trash/[id]/restore/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocIdParam } from "@/lib/validation";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const parsedParams = DocIdParam.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const { id } = parsedParams.data;

  await prisma.document.update({
    where: { id },
    data: { deletedAt: null },
  });

  return NextResponse.json({ ok: true });
}
