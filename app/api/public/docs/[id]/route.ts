// app/api/public/docs/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocIdParam } from "@/lib/validation";
import { Visibility } from "@prisma/client";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = DocIdParam.safeParse(await ctx.params);
  if (!parsed.success) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const { id } = parsed.data;

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, updatedAt: true, visibility: true },
  });

  if (!doc || doc.visibility !== Visibility.public) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}
