import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const senderSchema = z.object({
  phoneNumber: z.string().min(7),
  permissions: z.array(z.enum(['ADMIN', 'FREE_SENDING', 'DELETE_ALLOWED'])),
  groupAccess: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const senders = await prisma.authorizedSender.findMany({
    where: { clientId: session.user.clientId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(senders);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { phoneNumber, permissions, groupAccess } = senderSchema.parse(body);

  const sender = await prisma.authorizedSender.upsert({
    where: {
      clientId_phoneNumber: { clientId: session.user.clientId, phoneNumber },
    },
    update: { permissions, groupAccess },
    create: { clientId: session.user.clientId, phoneNumber, permissions, groupAccess },
  });

  return NextResponse.json(sender, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const schema = senderSchema.extend({ id: z.string() });
  const { id, ...data } = schema.parse(body);

  const sender = await prisma.authorizedSender.update({
    where: { id, clientId: session.user.clientId },
    data,
  });

  return NextResponse.json(sender);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.authorizedSender.delete({ where: { id, clientId: session.user.clientId } });
  return NextResponse.json({ success: true });
}
