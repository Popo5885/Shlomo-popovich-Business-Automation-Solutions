'use client';

import { useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, Shield, Headphones, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'SUPPORT' | 'BILLING_ONLY';
  isActive: boolean;
  createdAt: string;
}

const ROLE_CONFIG = {
  SUPPORT: {
    label: 'תמיכה',
    icon: Headphones,
    color: 'text-blue-600 bg-blue-50',
    desc: 'צפייה בלוגים, איפוס מכסות, עזרה בחיבור — ללא גישה לפיננסים',
  },
  BILLING_ONLY: {
    label: 'חיוב בלבד',
    icon: CreditCard,
    color: 'text-purple-600 bg-purple-50',
    desc: 'גישה לנתוני חיוב ו-CRM בלבד',
  },
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SUPPORT' });

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    const res = await fetch('/api/admin/staff');
    setStaff(await res.json());
  }

  async function addStaff() {
    setLoading(true);
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: '', email: '', password: '', role: 'SUPPORT' });
      setShowForm(false);
      await loadStaff();
    }
    setLoading(false);
  }

  async function removeStaff(id: string) {
    if (!confirm('מחק עובד זה?')) return;
    await fetch(`/api/admin/staff?id=${id}`, { method: 'DELETE' });
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול עובדים</h1>
          <p className="text-gray-500 mt-1">הוסף עובדי תמיכה עם הרשאות מוגבלות</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          הוסף עובד
        </Button>
      </div>

      {/* Permissions summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(ROLE_CONFIG).map(([role, config]) => {
          const Icon = config.icon;
          return (
            <Card key={role} className="border-gray-100">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{config.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Card className="border-blue-200">
          <CardHeader><CardTitle className="text-lg">עובד חדש</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>שם מלא</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>אימייל</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
              </div>
              <div>
                <Label>סיסמה</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <Label>תפקיד</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="SUPPORT">תמיכה</option>
                  <option value="BILLING_ONLY">חיוב בלבד</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={addStaff} disabled={loading || !form.name || !form.email || !form.password} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'שומר...' : 'הוסף עובד'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>ביטול</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">עובדים ({staff.length})</CardTitle></CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>אין עובדים עדיין.</p>
            </div>
          ) : (
            <div className="divide-y">
              {staff.map((s) => {
                const config = ROLE_CONFIG[s.role];
                const Icon = config.icon;
                return (
                  <div key={s.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{config.label}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => removeStaff(s.id)} className="text-red-500 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
