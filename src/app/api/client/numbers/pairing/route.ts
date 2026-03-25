import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SessionManager } from '@/server/whatsapp/SessionManager';
import { z } from 'zod';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { phoneNumber } = z.object({ phoneNumber: z.string().min(7) }).parse(body);

  // Upsert the number record
  const number = await prisma.connectedNumber.upsert({
    where: { clientId_phoneNumber: { clientId: session.user.clientId, phoneNumber } },
    update: { status: 'PAIRING_PENDING' },
    create: {
      clientId: session.user.clientId,
      phoneNumber,
      status: 'PAIRING_PENDING',
    },
    select: { id: true, phoneNumber: true },
  });

  // Request pairing code from Baileys
  const sm = SessionManager.getInstance();
  const pairingCode = await sm.requestPairingCode(session.user.clientId, number.id, phoneNumber);

  if (!pairingCode) {
    return NextResponse.json({ error: 'לא ניתן ליצור קוד חיבור כעת' }, { status: 500 });
  }

  // Save code with 5-minute expiry
  await prisma.connectedNumber.update({
    where: { id: number.id },
    data: {
      pairingCode,
      pairingCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json({ pairingCode, numberId: number.id });
}
