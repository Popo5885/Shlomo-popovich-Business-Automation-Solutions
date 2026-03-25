import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;

  const number = await prisma.connectedNumber.findFirst({
    where: {
      connectToken: token,
      connectTokenExpiresAt: { gt: new Date() },
    },
    include: {
      client: {
        select: { name: true, brandingConfig: true, customDomain: true },
      },
    },
  });

  if (!number) {
    return NextResponse.json({ error: 'קישור לא תקף או פג תוקף' }, { status: 404 });
  }

  return NextResponse.json({
    numberId: number.id,
    clientId: number.clientId,
    phoneNumber: number.phoneNumber,
    status: number.status,
    clientName: number.client.name,
    branding: number.client.brandingConfig,
  });
}
