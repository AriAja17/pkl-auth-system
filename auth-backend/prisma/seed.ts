import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { usernameFor } from '../src/auth/utils/username';
import { SYSTEM_ROLE_NAME, isProtectedPermissionKey } from '../src/authorization/constants';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

// Canonical `action:resource` catalogue (doc 07 §M2.4-6): 5 mapped legacy keys
// plus the 21 approved new keys. No legacy dotted key is created by seed.
const permissionKeys = [
  'read:article',
  'create:article',
  'update:article',
  'delete:article',
  'manage:user',
  'read:user',
  'create:user',
  'update:user',
  'delete:user',
  'read:role',
  'create:role',
  'update:role',
  'delete:role',
  'read:permission',
  'create:permission',
  'update:permission',
  'delete:permission',
  'read:menu',
  'create:menu',
  'update:menu',
  'delete:menu',
  'read:delegation',
  'create:delegation',
  'delete:delegation',
  'read:audit',
  'grant:admin',
];

async function main() {
  // 1. Permission catalogue + protected flags.
  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: { isProtected: isProtectedPermissionKey(key) },
      create: { key, isProtected: isProtectedPermissionKey(key) },
    });
  }

  // 2. Roles. superadmin is seeded with every permission and is immutable via API.
  const roles: Record<string, { keys: string[]; isSystem: boolean }> = {
    [SYSTEM_ROLE_NAME]: { keys: permissionKeys, isSystem: true },
    Editor: { keys: ['read:article', 'update:article'], isSystem: false },
    Penulis: { keys: ['read:article', 'create:article'], isSystem: false },
  };

  for (const [name, { keys, isSystem }] of Object.entries(roles)) {
    await prisma.role.upsert({
      where: { name },
      update: isSystem ? { isSystem: true } : {},
      create: {
        name,
        isSystem,
        permissions: {
          create: keys.map((key) => ({
            permission: { connect: { key } },
          })),
        },
      },
    });
  }

  // 3. Bootstrap superadmin account from env (idempotent upsert).
  const email = process.env.ADMIN_EMAIL as string;
  const password = process.env.ADMIN_PASSWORD as string;
  const hashed = await bcrypt.hash(password, 10);
  const existingUsernames = await prisma.user.findMany({
    select: { username: true },
  });
  const used = new Set(
    existingUsernames
      .map((u) => u.username?.toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
  const username = usernameFor(email, used);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashed,
      username,
      roles: {
        create: {
          role: { connect: { name: SYSTEM_ROLE_NAME } },
        },
      },
    },
  });

  console.log('Seeding selesai');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
