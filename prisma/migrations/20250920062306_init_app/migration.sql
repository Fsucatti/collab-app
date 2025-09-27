/*
  Warnings:

  - You are about to alter the column `author` on the `Comment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `resolvedBy` on the `Comment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `title` on the `Document` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - Added the required column `updatedAt` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Made the column `ownerId` on table `Document` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_ownerId_fkey";

-- DropIndex
DROP INDEX "public"."Document_ownerId_idx";

-- DropIndex
DROP INDEX "public"."Document_visibility_deletedAt_idx";

-- AlterTable
ALTER TABLE "public"."Comment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "author" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "resolvedBy" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "anchorText" DROP NOT NULL,
ALTER COLUMN "anchorText" DROP DEFAULT,
ALTER COLUMN "contextAfter" DROP NOT NULL,
ALTER COLUMN "contextAfter" DROP DEFAULT,
ALTER COLUMN "contextBefore" DROP NOT NULL,
ALTER COLUMN "contextBefore" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Document" ALTER COLUMN "title" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "ownerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Comment_documentId_createdAt_idx" ON "public"."Comment"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_resolved_updatedAt_idx" ON "public"."Comment"("resolved", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_ownerId_visibility_idx" ON "public"."Document"("ownerId", "visibility");

-- CreateIndex
CREATE INDEX "Document_updatedAt_idx" ON "public"."Document"("updatedAt");

-- CreateIndex
CREATE INDEX "Revision_documentId_createdAt_idx" ON "public"."Revision"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
