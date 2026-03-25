import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionManager } from '@/server/whatsapp/SessionManager';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const groups = await prisma.group.findMany({
    where: { clientId: session.user.clientId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const schema = z.object({
    jid: z.string(),
    name: z.string().min(1),
    customLink: z.string().url().optional().or(z.literal('')),
  });
  const { jid, name, customLink } = schema.parse(body);

  const group = await prisma.group.upsert({
    where: { clientId_jid: { clientId: session.user.clientId, jid } },
    update: { name, customLink: customLink || null },
    create: { clientId: session.user.clientId, jid, name, customLink: customLink || null },
  });

  return NextResponse.json(group, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const schema = z.object({
    id: z.string(),
    name: z.string().min(1).optional(),
    customLink: z.string().optional().nullable(),
  });
  const { id, ...data } = schema.parse(body);

  const group = await prisma.group.update({
    where: { id, clientId: session.user.clientId },
    data,
  });

  return NextResponse.json(group);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.group.delete({ where: { id, clientId: session.user.clientId } });
  return NextResponse.json({ success: true });
}

// Sync groups from WhatsApp
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sm = SessionManager.getInstance();
  const groups = await sm.fetchGroups(session.user.clientId);

  // Upsert all fetched groups
  const upserted = await Promise.all(
    groups.map((g) =>
      prisma.group.upsert({
        where: { clientId_jid: { clientId: session.user.clientId, jid: g.id } },
        update: { name: g.subject || g.id },
        create: { clientId: session.user.clientId, jid: g.id, name: g.subject || g.id },
      }),
    ),
  );

  return NextResponse.json({ synced: upserted.length });
}
