import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [totalClients, activeClients, onlineNumbers, totalCampaigns] = await Promise.all([
    prisma.client.count({ where: { email: { not: process.env.SUPER_ADMIN_EMAIL } } }),
    prisma.client.count({
      where: { isActive: true, email: { not: process.env.SUPER_ADMIN_EMAIL } },
    }),
    prisma.connectedNumber.count({ where: { status: 'ONLINE' } }),
    prisma.campaign.count({ where: { status: 'ACTIVE' } }),
  ]);

  const totalMessagesSent = await prisma.client.aggregate({
    _sum: { monthlyUsage: true },
  });

  return NextResponse.json({
    totalClients,
    activeClients,
    onlineNumbers,
    totalCampaigns,
    totalMessagesSent: totalMessagesSent._sum.monthlyUsage || 0,
  });
}
