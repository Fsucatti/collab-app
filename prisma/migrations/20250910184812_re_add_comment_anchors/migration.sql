-- AlterTable
ALTER TABLE "public"."Comment" ADD COLUMN     "anchorText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contextAfter" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contextBefore" TEXT NOT NULL DEFAULT '';
