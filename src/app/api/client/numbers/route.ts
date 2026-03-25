import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionManager } from '@/server/whatsapp/SessionManager';
import { z } from 'zod';

async function getClientSession(req: NextRequest) {
  const session = await auth();
  if (!session) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await getClientSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const numbers = await prisma.connectedNumber.findMany({
    where: { clientId: session.user.clientId },
    select: {
      id: true,
      phoneNumber: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(numbers);
}

export async function POST(req: NextRequest) {
  const session = await getClientSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { phoneNumber } = z.object({ phoneNumber: z.string().min(7) }).parse(body);

  // Create DB record
  const number = await prisma.connectedNumber.upsert({
    where: { clientId_phoneNumber: { clientId: session.user.clientId, phoneNumber } },
    update: { status: 'OFFLINE' },
    create: { clientId: session.user.clientId, phoneNumber, status: 'OFFLINE' },
    select: { id: true, phoneNumber: true, status: true },
  });

  // Start Baileys session (will emit QR via Socket.IO)
  const sm = SessionManager.getInstance();
  sm.startSession(session.user.clientId, number.id, phoneNumber);

  return NextResponse.json(number, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getClientSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Disconnect the WhatsApp session
  const sm = SessionManager.getInstance();
  await sm.disconnectSession(session.user.clientId, id);

  await prisma.connectedNumber.delete({
    where: { id, clientId: session.user.clientId },
  });

  return NextResponse.json({ success: true });
}
