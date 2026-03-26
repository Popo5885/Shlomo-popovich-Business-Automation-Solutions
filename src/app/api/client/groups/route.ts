import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionManager } from '@/server/whatsapp/SessionManager';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const groups = await prisma.group.findMany({
      where: { clientId: session.user.clientId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(groups);
  } catch (err) {
    console.error('GET /api/client/groups error:', err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (!session || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (!session || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.group.delete({ where: { id, clientId: session.user.clientId } });
  return NextResponse.json({ success: true });
}

// Sync groups from WhatsApp — tries ALL online sessions for this client
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = session.user.clientId;

  try {
    const sm = SessionManager.getInstance();
    const groups = await sm.fetchGroups(clientId);

    if (groups.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: 'אין מספרים מחוברים או שלא נמצאו קבוצות',
      });
    }

    // Upsert all fetched groups — run sequentially to avoid DB contention
    let synced = 0;
    for (const g of groups) {
      try {
        await prisma.group.upsert({
          where: { clientId_jid: { clientId, jid: g.id } },
          update: { name: g.subject || g.id },
          create: { clientId, jid: g.id, name: g.subject || g.id },
        });
        synced++;
      } catch (upsertErr) {
        console.error(`Failed to upsert group ${g.id}:`, upsertErr);
      }
    }

    return NextResponse.json({ synced });
  } catch (err) {
    console.error('PATCH /api/client/groups error:', err);
    return NextResponse.json({ error: 'שגיאה בסנכרון קבוצות', synced: 0 }, { status: 500 });
  }
}
