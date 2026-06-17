/*
  Warnings:

  - Added the required column `updated_at` to the `sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `verifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "access_token_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "password" TEXT,
ADD COLUMN     "refresh_token_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "scope" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" VARCHAR(300),
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "verifications" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;
