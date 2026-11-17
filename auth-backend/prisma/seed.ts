import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Permission
  const permissionKeys = [
    'article.read',
    'article.create',
    'article.update',
    'article.delete',
    'user.manage',
  ];

  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  // 2. Role
  const roles: Record<string, string[]> = {
    Admin: permissionKeys,
    Editor: ['article.read', 'article.update'],
    Penulis: ['article.read', 'article.create'],
  };

  for (const [name, keys] of Object.entries(roles)) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: {
        name,
        permissions: {
          create: keys.map((key) => ({
            permission: { connect: { key } },
          })),
        },
      },
    });
  }

  // 3. Admin
  const email = process.env.ADMIN_EMAIL as string;
  const password = process.env.ADMIN_PASSWORD as string;
  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashed,
      role: { connect: { name: 'Admin' } },
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