import { NextRequest, NextResponse } from 'next/server';
import { auth, isSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const staffSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPPORT', 'BILLING_ONLY']),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const staff = await prisma.staff.findMany({
    where: { role: { not: 'SUPER_ADMIN' } },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, role } = staffSchema.parse(body);

  const existing = await prisma.staff.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'אימייל כבר קיים' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const staff = await prisma.staff.create({
    data: { name, email, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json(staff, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.staff.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
