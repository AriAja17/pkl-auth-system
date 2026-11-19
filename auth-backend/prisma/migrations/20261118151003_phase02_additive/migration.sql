-- Phase 02 / M1 — additive schema adoption
--
-- K5 path: PREFERRED (citext). `pg_available_extensions` on the production project
-- reports citext 1.6 available, so the extension is created here. Do not drop it and
-- do not treat the M1.5 username unique index as drift. Apply all future migrations
-- with `prisma migrate deploy` only — never `migrate dev` on this database.
--
-- Staged field: `username` is added NULLABLE and WITHOUT a unique index here;
-- M1.5 backfills it, sets NOT NULL and adds the unique index after the K2 script.
-- `updatedAt` on the pre-existing User/Role tables is added NULLABLE here, backfilled
-- with COALESCE("createdAt", CURRENT_TIMESTAMP) in M1, then set NOT NULL in M1,
-- per the approved Phase 01 migration design.
--
-- Strictly additive: no DROP, no data rewrite, no constraint changes on legacy columns.
-- User."roleId", RolePermission."permissionsId" and Article are untouched.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS citext;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" CITEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Role" ADD COLUMN "description" TEXT,
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN "description" TEXT,
ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill newly added "updatedAt" columns in M1 (approved Phase 01 design).
-- Only columns introduced by this migration are written; no pre-existing column or row value is changed.
UPDATE "User" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;

UPDATE "Role" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;

-- Enforce NOT NULL only after the backfill above has populated every row.
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "Role" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuPermission" (
    "menuId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "MenuPermission_pkey" PRIMARY KEY ("menuId","permissionId")
);

-- CreateTable
CREATE TABLE "AdminCapability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "parentCapabilityId" TEXT,

    CONSTRAINT "AdminCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "Menu_parentId_idx" ON "Menu"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminCapability_userId_permissionId_key" ON "AdminCapability"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "AdminCapability_grantedBy_idx" ON "AdminCapability"("grantedBy");

-- CreateIndex
CREATE INDEX "AdminCapability_parentCapabilityId_idx" ON "AdminCapability"("parentCapabilityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPermission" ADD CONSTRAINT "MenuPermission_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPermission" ADD CONSTRAINT "MenuPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCapability" ADD CONSTRAINT "AdminCapability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCapability" ADD CONSTRAINT "AdminCapability_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCapability" ADD CONSTRAINT "AdminCapability_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCapability" ADD CONSTRAINT "AdminCapability_parentCapabilityId_fkey" FOREIGN KEY ("parentCapabilityId") REFERENCES "AdminCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
