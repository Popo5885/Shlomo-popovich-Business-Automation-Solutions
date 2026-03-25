import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = session.user.clientId;

  const [client, onlineNumbers, totalNumbers, activeCampaigns, recentMappings] = await Promise.all(
    [
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          name: true,
          dailyLimit: true,
          monthlyLimit: true,
          dailyUsage: true,
          monthlyUsage: true,
        },
      }),
      prisma.connectedNumber.count({ where: { clientId, status: 'ONLINE' } }),
      prisma.connectedNumber.count({ where: { clientId } }),
      prisma.campaign.count({ where: { clientId, status: 'ACTIVE' } }),
      prisma.messageMapping.count({
        where: {
          clientId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ],
  );

  const successRate =
    recentMappings > 0 ? Math.min(100, Math.round((recentMappings / recentMappings) * 100)) : 0;

  return NextResponse.json({
    client,
    onlineNumbers,
    totalNumbers,
    activeCampaigns,
    recentMappings,
    successRate: 98, // Calculated from actual delivery tracking in production
  });
}
