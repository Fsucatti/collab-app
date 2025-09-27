/*
  Warnings:

  - You are about to drop the column `anchorText` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `contextAfter` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `contextBefore` on the `Comment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Comment" DROP COLUMN "anchorText",
DROP COLUMN "contextAfter",
DROP COLUMN "contextBefore",
ADD COLUMN     "resolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedBy" TEXT;
