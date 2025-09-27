-- CreateEnum
CREATE TYPE "public"."Visibility" AS ENUM ('PRIVATE', 'WORKSPACE', 'PUBLIC');

-- AlterTable
ALTER TABLE "public"."Document" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "visibility" "public"."Visibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "public"."Document"("deletedAt");

-- CreateIndex
CREATE INDEX "Document_visibility_deletedAt_idx" ON "public"."Document"("visibility", "deletedAt");
