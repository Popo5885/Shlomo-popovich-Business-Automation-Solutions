'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard, AlertTriangle, CheckCircle, Clock, XCircle,
  Ban, Play, Edit, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BillingClient {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  lastPaymentDate: string | null;
  nextBillingDate: string | null;
  paymentNotes: string | null;
  trialEndsAt: string | null;
  isActive: boolean;
  dailyUsage: number;
  dailyLimit: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ACTIVE:    { label: 'פעיל',    color: 'text-green-600 bg-green-50 border-green-200',  icon: CheckCircle },
  TRIAL:     { label: 'ניסיון',  color: 'text-blue-600 bg-blue-50 border-blue-200',     icon: Clock },
  SUSPENDED: { label: 'מושהה',  color: 'text-red-600 bg-red-50 border-red-200',        icon: Ban },
  EXPIRED:   { label: 'פג תוקף', color: 'text-gray-600 bg-gray-50 border-gray-200',    icon: XCircle },
  CANCELLED: { label: 'בוטל',   color: 'text-gray-500 bg-gray-50 border-gray-200',     icon: XCircle },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryIndicator({ nextBillingDate }: { nextBillingDate: string | null }) {
  const days = daysUntil(nextBillingDate);
  if (days === null) return <span className="text-xs text-muted-foreground">לא מוגדר</span>;
  if (days < 0) return <span className="text-xs font-bold text-red-600">⚠️ פג תוקף</span>;
  if (days <= 7) return <span className="text-xs font-bold text-red-500">🔴 {days} ימים</span>;
  if (days <= 14) return <span className="text-xs font-bold text-yellow-600">🟡 {days} ימים</span>;
  return <span className="text-xs text-green-600">🟢 {days} ימים</span>;
}

export default function BillingPage() {
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BillingClient>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const res = await fetch('/api/admin/billing');
    setClients(await res.json());
  }

  async function suspendClient(id: string) {
    if (!confirm('השעה את הלקוח ועצור את כל התורים שלו מיידית?')) return;
    setLoading(true);
    await fetch('/api/admin/billing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, subscriptionStatus: 'SUSPENDED' }),
    });
    await loadClients();
    setLoading(false);
  }

  async function activateClient(id: string) {
    setLoading(true);
    await fetch('/api/admin/billing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, subscriptionStatus: 'ACTIVE' }),
    });
    await loadClients();
    setLoading(false);
  }

  async function saveEdit() {
    if (!editId) return;
    setLoading(true);
    await fetch('/api/admin/billing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId, ...editForm }),
    });
    setEditId(null);
    setEditForm({});
    await loadClients();
    setLoading(false);
  }

  // Summary stats
  const stats = {
    active: clients.filter((c) => c.subscriptionStatus === 'ACTIVE').length,
    trial: clients.filter((c) => c.subscriptionStatus === 'TRIAL').length,
    suspended: clients.filter((c) => c.subscriptionStatus === 'SUSPENDED').length,
    expiringSoon: clients.filter((c) => {
      const d = daysUntil(c.nextBillingDate);
      return d !== null && d >= 0 && d <= 7;
    }).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ניהול חיוב ו-CRM</h1>
        <p className="text-gray-500 mt-1">מעקב תשלומים, מנויים ופעילות לקוחות</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-xs text-muted-foreground">לקוחות פעילים</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.trial}</p>
              <p className="text-xs text-muted-foreground">בתקופת ניסיון</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.expiringSoon}</p>
              <p className="text-xs text-muted-foreground">פג בקרוב (7 ימים)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Ban className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.suspended}</p>
              <p className="text-xs text-muted-foreground">מושהים</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            פרטי חיוב לקוחות ({clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-muted-foreground">
                  <th className="text-right py-3 px-4 font-medium">לקוח</th>
                  <th className="text-right py-3 px-4 font-medium">סטטוס מנוי</th>
                  <th className="text-right py-3 px-4 font-medium">תשלום אחרון</th>
                  <th className="text-right py-3 px-4 font-medium">חידוש הבא</th>
                  <th className="text-right py-3 px-4 font-medium">שימוש</th>
                  <th className="text-right py-3 px-4 font-medium">הערות</th>
                  <th className="text-right py-3 px-4 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const statusCfg = STATUS_CONFIG[client.subscriptionStatus] || STATUS_CONFIG.EXPIRED;
                  const Icon = statusCfg.icon;
                  const isEditingThis = editId === client.id;

                  return (
                    <tr key={client.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                          {client.company && (
                            <p className="text-xs text-muted-foreground">{client.company}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {client.lastPaymentDate
                          ? new Date(client.lastPaymentDate).toLocaleDateString('he-IL')
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-muted-foreground text-xs">
                            {client.nextBillingDate
                              ? new Date(client.nextBillingDate).toLocaleDateString('he-IL')
                              : '—'}
                          </p>
                          <ExpiryIndicator nextBillingDate={client.nextBillingDate} />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{
                                width: `${Math.min(100, (client.dailyUsage / client.dailyLimit) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {client.dailyUsage}/{client.dailyLimit}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-[150px]">
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={editForm.paymentNotes || ''}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, paymentNotes: e.target.value }))
                            }
                            className="w-full text-xs border rounded px-2 py-1"
                            placeholder="הערות תשלום..."
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground truncate">
                            {client.paymentNotes || '—'}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1.5">
                          {isEditingThis ? (
                            <>
                              <Button size="sm" onClick={saveEdit} disabled={loading}>
                                שמור
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditId(null); setEditForm({}); }}
                              >
                                ביטול
                              </Button>
                            </>
                          ) : (
                            <>
                              {client.subscriptionStatus === 'SUSPENDED' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => activateClient(client.id)}
                                  disabled={loading}
                                  className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                                >
                                  <Play className="w-3 h-3" />
                                  הפעל
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => suspendClient(client.id)}
                                  disabled={loading}
                                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <Ban className="w-3 h-3" />
                                  הקפא
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditId(client.id);
                                  setEditForm({
                                    subscriptionStatus: client.subscriptionStatus as 'ACTIVE',
                                    lastPaymentDate: client.lastPaymentDate,
                                    nextBillingDate: client.nextBillingDate,
                                    paymentNotes: client.paymentNotes,
                                  });
                                }}
                              >
                                <Edit className="w-3.5 h-3.5 text-gray-400" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
