// app/api/trash/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/permissions";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const p = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const ps = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));

  const where: Prisma.DocumentWhereInput = {
    ownerId: user.id,
    deletedAt: { not: null }, // trashed only
  };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (p - 1) * ps,
      take: ps,
      select: { id: true, title: true, updatedAt: true, deletedAt: true, visibility: true },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json({ rows, total, page: p, pageSize: ps });
}
