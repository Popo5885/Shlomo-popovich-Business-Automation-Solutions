import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const campaignSchema = z.object({
  name: z.string().min(1),
  sourceGroupJid: z.string(),
  triggerType: z.enum(['DIRECT', 'LISTENER']).default('LISTENER'),
  textSuffix: z.string().optional().nullable(),
  mediaSuffix: z.string().optional().nullable(),
  requireApproval: z.boolean().default(true),
  minDelay: z.number().int().min(1).default(3),
  maxDelay: z.number().int().min(1).default(10),
  targetJids: z.array(z.string()).min(1),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { clientId: session.user.clientId },
    include: {
      targets: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { targetJids, ...data } = campaignSchema.parse(body);

  const campaign = await prisma.campaign.create({
    data: {
      ...data,
      clientId: session.user.clientId,
      targets: {
        create: targetJids.map((jid) => ({ groupJid: jid })),
      },
    },
    include: { targets: true },
  });

  return NextResponse.json(campaign, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const schema = campaignSchema.partial().extend({ id: z.string() });
  const { id, targetJids, ...data } = schema.parse(body);

  const campaign = await prisma.$transaction(async (tx) => {
    if (targetJids) {
      await tx.campaignTarget.deleteMany({ where: { campaignId: id } });
    }

    return tx.campaign.update({
      where: { id, clientId: session.user.clientId },
      data: {
        ...data,
        ...(targetJids && {
          targets: { create: targetJids.map((jid) => ({ groupJid: jid })) },
        }),
      },
      include: { targets: true },
    });
  });

  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await prisma.campaign.delete({ where: { id, clientId: session.user.clientId } });
  return NextResponse.json({ success: true });
}
