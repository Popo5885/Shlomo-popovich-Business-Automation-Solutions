import { NextRequest, NextResponse } from 'next/server';
import { auth, canAccessBilling, canDeleteClients } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { QueueManager } from '@/server/queue/QueueManager';

const updateBillingSchema = z.object({
  id: z.string(),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED']).optional(),
  subscriptionPlan: z.string().optional(),
  lastPaymentDate: z.string().optional().nullable(),
  nextBillingDate: z.string().optional().nullable(),
  paymentNotes: z.string().optional().nullable(),
  trialEndsAt: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !canAccessBilling(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const clients = await prisma.client.findMany({
    where: { email: { not: superAdminEmail } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      lastPaymentDate: true,
      nextBillingDate: true,
      paymentNotes: true,
      trialEndsAt: true,
      isActive: true,
      createdAt: true,
      dailyUsage: true,
      dailyLimit: true,
      monthlyUsage: true,
      monthlyLimit: true,
    },
    orderBy: { nextBillingDate: 'asc' },
  });

  return NextResponse.json(clients);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || !canAccessBilling(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateBillingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (data.subscriptionStatus !== undefined) {
    updateData.subscriptionStatus = data.subscriptionStatus;
    // If suspending, also deactivate
    if (data.subscriptionStatus === 'SUSPENDED') {
      updateData.isActive = false;
    } else if (data.subscriptionStatus === 'ACTIVE') {
      updateData.isActive = true;
    }
  }
  if (data.subscriptionPlan !== undefined) updateData.subscriptionPlan = data.subscriptionPlan;
  if (data.lastPaymentDate !== undefined)
    updateData.lastPaymentDate = data.lastPaymentDate ? new Date(data.lastPaymentDate) : null;
  if (data.nextBillingDate !== undefined)
    updateData.nextBillingDate = data.nextBillingDate ? new Date(data.nextBillingDate) : null;
  if (data.paymentNotes !== undefined) updateData.paymentNotes = data.paymentNotes;
  if (data.trialEndsAt !== undefined)
    updateData.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;

  const client = await prisma.client.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, subscriptionStatus: true, isActive: true },
  });

  // If suspended, pause all their queues instantly
  if (data.subscriptionStatus === 'SUSPENDED') {
    const numbers = await prisma.connectedNumber.findMany({
      where: { clientId: id },
      select: { id: true },
    });
    const qm = QueueManager.getInstance();
    await Promise.all(numbers.map((n) => qm.pauseQueue(n.id)));

    // Log this action
    await prisma.activityLog.create({
      data: {
        clientId: id,
        actor: session.user.email || 'admin',
        action: 'client.suspended',
        details: { reason: 'Billing suspension via admin panel' },
      },
    });
  }

  return NextResponse.json(client);
}
