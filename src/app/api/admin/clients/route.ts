import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createClientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  dailyLimit: z.number().int().positive().default(500),
  monthlyLimit: z.number().int().positive().default(10000),
});

const updateClientSchema = z.object({
  id: z.string(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  dailyLimit: z.number().int().positive().optional(),
  monthlyLimit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  blockedHours: z
    .object({ start: z.string(), end: z.string(), timezone: z.string() })
    .nullable()
    .optional(),
});

async function requireSuperAdmin(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'super_admin') {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireSuperAdmin(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const clients = await prisma.client.findMany({
    where: { email: { not: superAdminEmail } },
    select: {
      id: true,
      name: true,
      email: true,
      dailyLimit: true,
      monthlyLimit: true,
      dailyUsage: true,
      monthlyUsage: true,
      isActive: true,
      blockedHours: true,
      createdAt: true,
      _count: {
        select: {
          sessions: { where: { status: 'ONLINE' } },
          campaigns: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, dailyLimit, monthlyLimit } = parsed.data;

  const existing = await prisma.client.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'כתובת האימייל כבר קיימת במערכת' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await prisma.client.create({
    data: { name, email, passwordHash, dailyLimit, monthlyLimit },
    select: {
      id: true,
      name: true,
      email: true,
      dailyLimit: true,
      monthlyLimit: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json(client, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await requireSuperAdmin(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, password, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };

  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 12);
  }

  const client = await prisma.client.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      dailyLimit: true,
      monthlyLimit: true,
      isActive: true,
    },
  });

  return NextResponse.json(client);
}

export async function DELETE(req: NextRequest) {
  const session = await requireSuperAdmin(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
