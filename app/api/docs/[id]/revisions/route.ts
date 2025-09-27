// app/api/docs/[id]/revisions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const cursor = url.searchParams.get("cursor") || undefined;

  const items = await prisma.revision.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: { id: true, documentId: true, createdAt: true },
  });

  const nextCursor = items.length === limit ? items[items.length - 1].id : null;

  return NextResponse.json({ items, nextCursor });
}
