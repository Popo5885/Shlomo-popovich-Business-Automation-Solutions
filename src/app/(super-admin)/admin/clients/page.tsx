'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Pencil, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Client {
  id: string;
  name: string;
  email: string;
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsage: number;
  monthlyUsage: number;
  isActive: boolean;
  createdAt: string;
  _count?: { sessions: { status: 'ONLINE' }[]; campaigns: number };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    dailyLimit: 500,
    monthlyLimit: 10000,
  });

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const res = await fetch('/api/admin/clients');
    setClients(await res.json());
  }

  async function saveClient() {
    setLoading(true);
    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...form } : form;

    const res = await fetch('/api/admin/clients', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'שגיאה בשמירה');
    } else {
      resetForm();
      await loadClients();
    }
    setLoading(false);
  }

  async function toggleActive(client: Client) {
    await fetch('/api/admin/clients', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: client.id, isActive: !client.isActive }),
    });
    await loadClients();
  }

  async function deleteClient(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק לקוח זה? פעולה זו אינה הפיכה.')) return;
    await fetch(`/api/admin/clients?id=${id}`, { method: 'DELETE' });
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  function resetForm() {
    setForm({ name: '', email: '', password: '', dailyLimit: 500, monthlyLimit: 10000 });
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(c: Client) {
    setEditId(c.id);
    setForm({
      name: c.name,
      email: c.email,
      password: '',
      dailyLimit: c.dailyLimit,
      monthlyLimit: c.monthlyLimit,
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול לקוחות</h1>
          <p className="text-gray-500 mt-1">צור, ערוך ונהל חשבונות לקוחות</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          לקוח חדש
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">
              {editId ? 'עריכת לקוח' : 'לקוח חדש'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>שם מלא</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="שם הלקוח"
                />
              </div>
              <div>
                <Label>כתובת אימייל</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="client@example.com"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>סיסמה {editId && '(השאר ריק לשמירה)'}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editId ? 'ללא שינוי' : 'סיסמה חדשה'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>מגבלה יומית (הודעות)</Label>
                <Input
                  type="number"
                  value={form.dailyLimit}
                  onChange={(e) => setForm({ ...form, dailyLimit: Number(e.target.value) })}
                  min={1}
                />
              </div>
              <div>
                <Label>מגבלה חודשית (הודעות)</Label>
                <Input
                  type="number"
                  value={form.monthlyLimit}
                  onChange={(e) => setForm({ ...form, monthlyLimit: Number(e.target.value) })}
                  min={1}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={saveClient}
                disabled={loading || !form.name || !form.email || (!editId && !form.password)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'שומר...' : editId ? 'עדכן לקוח' : 'צור לקוח'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                ביטול
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">לקוחות ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>אין לקוחות עדיין.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-right py-3 px-2 font-medium">שם</th>
                    <th className="text-right py-3 px-2 font-medium">אימייל</th>
                    <th className="text-right py-3 px-2 font-medium">מכסה יומית</th>
                    <th className="text-right py-3 px-2 font-medium">מכסה חודשית</th>
                    <th className="text-right py-3 px-2 font-medium">סטטוס</th>
                    <th className="text-right py-3 px-2 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const dailyPct = Math.round((client.dailyUsage / client.dailyLimit) * 100);
                    return (
                      <tr key={client.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2 font-medium text-gray-900">{client.name}</td>
                        <td className="py-3 px-2 text-muted-foreground" dir="ltr">
                          {client.email}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  dailyPct >= 90
                                    ? 'bg-red-500'
                                    : dailyPct >= 70
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${dailyPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {client.dailyUsage}/{client.dailyLimit}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {client.monthlyUsage.toLocaleString()}/{client.monthlyLimit.toLocaleString()}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant={client.isActive ? 'success' : 'destructive'}>
                            {client.isActive ? 'פעיל' : 'מושבת'}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleActive(client)}
                              title={client.isActive ? 'השבת' : 'הפעל'}
                            >
                              <Power
                                className={`w-4 h-4 ${client.isActive ? 'text-green-600' : 'text-gray-400'}`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEdit(client)}
                            >
                              <Pencil className="w-4 h-4 text-gray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteClient(client.id)}
                              className="text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
