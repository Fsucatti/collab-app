// lib/permissions.ts
// Single source of truth for who can do what with a document.
//
//                          owner   signed-in user   anonymous
//   read public doc          yes        yes            yes
//   read private/team doc    yes        no             no
//   edit public doc          yes        yes            no
//   edit private/team doc    yes        no             no
//   comment                  if they can read and are signed in
//   title, visibility,
//   trash, moderate comments yes        no             no
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Visibility } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CurrentUser = { id: string; name: string };

export type DocAccess = {
  exists: boolean;
  isOwner: boolean;
  canRead: boolean;
  canEdit: boolean;
  canComment: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) return null;
  return { id: user.id, name: user.name ?? user.email ?? "User" };
}

export function accessFor(
  doc: { ownerId: string; visibility: Visibility; deletedAt: Date | null } | null,
  userId: string | null
): DocAccess {
  // Trashed documents are only reachable through the owner's /api/trash routes.
  if (!doc || doc.deletedAt) {
    return { exists: false, isOwner: false, canRead: false, canEdit: false, canComment: false };
  }
  const isOwner = !!userId && doc.ownerId === userId;
  const isPublic = doc.visibility === Visibility.public;
  const canRead = isOwner || isPublic;
  const canEdit = isOwner || (isPublic && !!userId);
  return { exists: true, isOwner, canRead, canEdit, canComment: canRead && !!userId };
}

export async function getDocAccess(docId: string, userId: string | null): Promise<DocAccess> {
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: { ownerId: true, visibility: true, deletedAt: true },
  });
  return accessFor(doc, userId);
}

/** Response for a request that failed a permission check. */
export function denied(access: Pick<DocAccess, "exists">, userId: string | null) {
  if (!access.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
