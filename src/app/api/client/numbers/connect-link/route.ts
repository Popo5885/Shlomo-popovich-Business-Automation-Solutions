import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { numberId } = body;
  if (!numberId) return NextResponse.json({ error: 'Missing numberId' }, { status: 400 });

  // Verify ownership
  const number = await prisma.connectedNumber.findFirst({
    where: { id: numberId, clientId: session.user.clientId },
  });
  if (!number) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Generate secure token (24h expiry)
  const connectToken = crypto.randomBytes(32).toString('hex');
  await prisma.connectedNumber.update({
    where: { id: numberId },
    data: {
      connectToken,
      connectTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const url = `${baseUrl}/connect/${connectToken}`;

  return NextResponse.json({ url, token: connectToken });
}
