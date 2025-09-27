/*
  Warnings:

  - The values [PRIVATE,WORKSPACE,PUBLIC] on the enum `Visibility` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Visibility_new" AS ENUM ('private', 'team', 'public');
ALTER TABLE "public"."Document" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "public"."Document" ALTER COLUMN "visibility" TYPE "public"."Visibility_new" USING ("visibility"::text::"public"."Visibility_new");
ALTER TYPE "public"."Visibility" RENAME TO "Visibility_old";
ALTER TYPE "public"."Visibility_new" RENAME TO "Visibility";
DROP TYPE "public"."Visibility_old";
ALTER TABLE "public"."Document" ALTER COLUMN "visibility" SET DEFAULT 'private';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Document" ALTER COLUMN "visibility" SET DEFAULT 'private';
