import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'shlomo@example.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(password, 12);

  // Upsert super admin settings
  await prisma.superAdminSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      blockedKeywords: [],
      globalPaused: false,
    },
  });

  // Upsert super admin client record (role stored in JWT)
  const existing = await prisma.client.findUnique({ where: { email } });
  if (!existing) {
    await prisma.client.create({
      data: {
        name: 'שלמה פופוביץ',
        email,
        passwordHash,
        dailyLimit: 999999,
        monthlyLimit: 9999999,
        isActive: true,
      },
    });
    console.log(`✅ Super admin seeded: ${email}`);
  } else {
    console.log(`ℹ️  Super admin already exists: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
