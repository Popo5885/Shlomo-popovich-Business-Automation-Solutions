import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'aknvpupuch@gmail.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Popo5885';
  const passwordHash = await bcrypt.hash(password, 12);

  // Upsert super admin settings singleton
  await prisma.superAdminSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      blockedKeywords: [],
      globalPaused: false,
    },
  });

  // Upsert system settings singleton
  await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      shabbatBlockEnabled: true,
    },
  });

  // Upsert super admin Staff record (checked first in auth)
  await prisma.staff.upsert({
    where: { email },
    update: {},
    create: {
      name: 'שלמה פופוביץ',
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`✅ Super admin seeded: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
