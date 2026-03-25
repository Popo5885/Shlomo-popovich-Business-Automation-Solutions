import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { QuotaProgress } from '@/components/dashboard/QuotaProgress';
import { DisconnectBanner } from '@/components/dashboard/DisconnectBanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  SendHorizonal,
  CheckCircle2,
  Smartphone,
  Megaphone,
  Users2,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const clientId = session!.user.clientId;

  const [client, onlineNumbers, totalNumbers, activeCampaigns, totalMappings, recentNumbers] =
    await Promise.all([
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
      prisma.messageMapping.count({ where: { clientId } }),
      prisma.connectedNumber.findMany({
        where: { clientId },
        select: { phoneNumber: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

  const statusLabels: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
    ONLINE: { label: 'מחובר', variant: 'success' },
    OFFLINE: { label: 'מנותק', variant: 'destructive' },
    PAUSED: { label: 'מושהה', variant: 'warning' },
    BANNED: { label: 'חסום', variant: 'destructive' },
  };

  return (
    <div className="space-y-6">
      {/* Disconnect Banner */}
      <DisconnectBanner clientId={clientId} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          שלום, {client?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">לוח הבקרה שלך - עדכון בזמן אמת</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="סה״כ הודעות שנשלחו"
          value={totalMappings.toLocaleString('he-IL')}
          subtitle="מאז תחילת פעילות"
          icon={SendHorizonal}
          iconColor="text-green-600"
        />
        <MetricCard
          title="אחוז הצלחה"
          value="98%"
          subtitle="ממוצע אחרון 7 ימים"
          icon={TrendingUp}
          iconColor="text-blue-600"
          trend={{ value: 2, label: 'לעומת שבוע שעבר' }}
        />
        <MetricCard
          title="מספרים מחוברים"
          value={`${onlineNumbers} / ${totalNumbers}`}
          subtitle="WhatsApp פעיל"
          icon={Smartphone}
          iconColor="text-purple-600"
        />
        <MetricCard
          title="קמפיינים פעילים"
          value={activeCampaigns}
          subtitle="שידורים בפעולה"
          icon={Megaphone}
          iconColor="text-orange-600"
        />
      </div>

      {/* Quota + Numbers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quota */}
        <QuotaProgress
          dailyUsage={client?.dailyUsage || 0}
          dailyLimit={client?.dailyLimit || 500}
          monthlyUsage={client?.monthlyUsage || 0}
          monthlyLimit={client?.monthlyLimit || 10000}
        />

        {/* Recent Numbers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-gray-600" />
              מספרים אחרונים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                אין מספרים מחוברים עדיין
              </p>
            ) : (
              <div className="space-y-2">
                {recentNumbers.map((n) => {
                  const statusInfo = statusLabels[n.status] || {
                    label: n.status,
                    variant: 'secondary' as const,
                  };
                  return (
                    <div
                      key={n.phoneNumber}
                      className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-sm font-medium text-gray-800" dir="ltr">
                        +{n.phoneNumber}
                      </span>
                      <Badge variant={statusInfo.variant as 'success' | 'destructive' | 'warning' | 'secondary'}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
