// app/api/docs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeDocHTML, sanitizePlainText } from "@/lib/sanitize";
import { CreateDocBody } from "@/lib/validation";
import { Prisma, Visibility } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const url = new URL(req.url);
  const p  = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const ps = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  const q  = url.searchParams.get("q")?.trim() || "";

  // parse & validate visibility filter from query
  const visParamStr = url.searchParams.get("visibility")?.toUpperCase();
  const visParam: Visibility | undefined =
    visParamStr && (Object.values(Visibility) as string[]).includes(visParamStr)
      ? (visParamStr as Visibility)
      : undefined;

  // base (not deleted)
  const baseWhere: Prisma.DocumentWhereInput = { deletedAt: null };

  // title filter
  const titleFilter: Prisma.DocumentWhereInput = q
    ? { title: { contains: q, mode: Prisma.QueryMode.insensitive } }
    : {};

  // visibility filter (if provided)
  const explicitVisFilter: Prisma.DocumentWhereInput = visParam
    ? { visibility: visParam }
    : {};

  // ownership / public access rule
  const ownershipFilter: Prisma.DocumentWhereInput = userId
    ? { OR: [{ ownerId: userId }, { visibility: Visibility.public }] }
    : { visibility: Visibility.public };

  const where: Prisma.DocumentWhereInput = {
    AND: [baseWhere, ownershipFilter, explicitVisFilter, titleFilter],
  };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (p - 1) * ps,
      take: ps,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        deletedAt: true,
        visibility: true,
      },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json({ rows, total, page: p, pageSize: ps });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateDocBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const title = parsed.data.title ? sanitizePlainText(parsed.data.title) : "Untitled";
  const content = sanitizeDocHTML(parsed.data.content ?? "<p></p>");

  // normalize to enum
  const visStr = parsed.data.visibility?.toUpperCase();
  const visibility: Visibility =
    visStr && (Object.values(Visibility) as string[]).includes(visStr)
      ? (visStr as Visibility)
      : Visibility.private;

  const created = await prisma.document.create({
  data: {
    id: crypto.randomUUID(),
    title,
    content,
    visibility,               // "private" | "team" | "public" (enum)
    ownerId: session.user.id, // FK now always valid
  },
  select: { id: true, title: true, visibility: true, updatedAt: true },
});

  await prisma.revision.create({
    data: { documentId: created.id, content },
  });

  return NextResponse.json(created, { status: 201 });
}
