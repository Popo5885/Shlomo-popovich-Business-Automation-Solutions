import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Smartphone, Megaphone, TrendingUp, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await auth();

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const [totalClients, activeClients, onlineNumbers, activeCampaigns, bannedNumbers, recentClients] =
    await Promise.all([
      prisma.client.count({ where: { email: { not: superAdminEmail } } }),
      prisma.client.count({ where: { isActive: true, email: { not: superAdminEmail } } }),
      prisma.connectedNumber.count({ where: { status: 'ONLINE' } }),
      prisma.campaign.count({ where: { status: 'ACTIVE' } }),
      prisma.connectedNumber.count({ where: { status: 'BANNED' } }),
      prisma.client.findMany({
        where: { email: { not: superAdminEmail } },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          dailyUsage: true,
          dailyLimit: true,
          _count: { select: { sessions: true, campaigns: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">סקירת מערכת</h1>
        <p className="text-gray-500 mt-1">ניהול כל הלקוחות והמשאבים</p>
      </div>

      {/* Alerts */}
      {bannedNumbers > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            {bannedNumbers} מספרי WhatsApp חסומים / מנותקים במערכת
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="סה״כ לקוחות"
          value={totalClients}
          subtitle={`${activeClients} פעילים`}
          icon={Users}
          iconColor="text-blue-600"
        />
        <MetricCard
          title="מספרים מחוברים"
          value={onlineNumbers}
          subtitle="WhatsApp Online"
          icon={Smartphone}
          iconColor="text-green-600"
        />
        <MetricCard
          title="קמפיינים פעילים"
          value={activeCampaigns}
          subtitle="שידורים בפעולה"
          icon={Megaphone}
          iconColor="text-orange-600"
        />
        <MetricCard
          title="מספרים חסומים"
          value={bannedNumbers}
          subtitle="דורשים טיפול"
          icon={AlertCircle}
          iconColor="text-red-600"
        />
      </div>

      {/* Recent Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>לקוחות אחרונים</span>
            <a href="/admin/clients" className="text-sm font-normal text-blue-600 hover:underline">
              כל הלקוחות →
            </a>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {recentClients.map((client) => {
              const usagePct =
                client.dailyLimit > 0
                  ? Math.round((client.dailyUsage / client.dailyLimit) * 100)
                  : 0;
              return (
                <div key={client.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-700">
                        {client.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{client._count.sessions} מספרים</span>
                    <span>{client._count.campaigns} קמפיינים</span>
                    <span
                      className={
                        usagePct >= 90
                          ? 'text-red-600 font-semibold'
                          : usagePct >= 70
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }
                    >
                      {usagePct}% מכסה
                    </span>
                    <Badge variant={client.isActive ? 'success' : 'destructive'}>
                      {client.isActive ? 'פעיל' : 'מושבת'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
