'use client';

import { useEffect, useState } from 'react';
import { Users2, Plus, Trash2, Pencil, Shield, Zap, Eraser } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Sender {
  id: string;
  phoneNumber: string;
  permissions: string[];
  groupAccess: string[];
}

const PERMISSION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ADMIN: { label: 'מנהל', icon: Shield, color: 'text-red-600' },
  FREE_SENDING: { label: 'שליחה חופשית', icon: Zap, color: 'text-yellow-600' },
  DELETE_ALLOWED: { label: 'מחיקה', icon: Eraser, color: 'text-blue-600' },
};

export default function SendersPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    phoneNumber: '',
    permissions: [] as string[],
    groupAccess: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSenders();
  }, []);

  async function loadSenders() {
    const res = await fetch('/api/client/senders');
    setSenders(await res.json());
  }

  async function saveSender() {
    setLoading(true);
    const payload = {
      phoneNumber: form.phoneNumber,
      permissions: form.permissions,
      groupAccess: form.groupAccess
        ? form.groupAccess.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };

    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...payload } : payload;

    await fetch('/api/client/senders', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setForm({ phoneNumber: '', permissions: [], groupAccess: '' });
    setEditId(null);
    await loadSenders();
    setLoading(false);
  }

  async function deleteSender(id: string) {
    if (!confirm('מחק שולח מורשה זה?')) return;
    await fetch(`/api/client/senders?id=${id}`, { method: 'DELETE' });
    setSenders((prev) => prev.filter((s) => s.id !== id));
  }

  function togglePermission(perm: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  function startEdit(s: Sender) {
    setEditId(s.id);
    setForm({
      phoneNumber: s.phoneNumber,
      permissions: s.permissions,
      groupAccess: s.groupAccess.join(', '),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">שולחים מורשים</h1>
        <p className="text-gray-500 mt-1">הגדר מי רשאי להפעיל שידורים</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {editId ? 'עריכת שולח' : 'הוסף שולח מורשה'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>מספר טלפון</Label>
            <Input
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              placeholder="972501234567"
              dir="ltr"
              className="max-w-xs"
            />
          </div>

          <div>
            <Label className="mb-2 block">הרשאות</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERMISSION_LABELS).map(([perm, info]) => {
                const Icon = info.icon;
                const selected = form.permissions.includes(perm);
                return (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${selected ? 'text-green-600' : info.color}`} />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>קבוצות מותרות (JIDs מופרדים בפסיק, ריק = כל הקבוצות)</Label>
            <Input
              value={form.groupAccess}
              onChange={(e) => setForm({ ...form, groupAccess: e.target.value })}
              placeholder="120363000000@g.us, 120363111111@g.us"
              dir="ltr"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={saveSender} disabled={loading || !form.phoneNumber}>
              {loading ? 'שומר...' : editId ? 'עדכן' : 'הוסף'}
            </Button>
            {editId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditId(null);
                  setForm({ phoneNumber: '', permissions: [], groupAccess: '' });
                }}
              >
                ביטול
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Senders List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">שולחים ({senders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {senders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>אין שולחים מורשים עדיין.</p>
            </div>
          ) : (
            <div className="divide-y">
              {senders.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                      <Users2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900" dir="ltr">
                        +{s.phoneNumber}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.permissions.map((p) => {
                          const info = PERMISSION_LABELS[p];
                          return info ? (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {info.label}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(s)}>
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSender(s.id)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
