-- Phase 02 / M1.5 — username constraints
-- MUST run AFTER the K2 backfill script (`npx tsx prisma/scripts/backfill-username.ts --apply`)
-- has completed and its post-apply verification has passed.
--
-- The column is CITEXT, so this unique index enforces case-insensitive uniqueness
-- by type; no lower() functional index is needed. Keep this index: it is the real
-- case-insensitive guard. Apply migrations with `prisma migrate deploy` only.

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
