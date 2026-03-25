'use client';

import { useEffect, useState } from 'react';
import { Smartphone, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QRCodeDisplay } from '@/components/whatsapp/QRCodeDisplay';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  status: 'ONLINE' | 'OFFLINE' | 'PAUSED' | 'BANNED';
}

const STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  ONLINE: { label: 'מחובר ✅', variant: 'success' },
  OFFLINE: { label: 'מנותק', variant: 'destructive' },
  PAUSED: { label: 'מושהה ⏸️', variant: 'warning' },
  BANNED: { label: 'חסום 🚫', variant: 'destructive' },
};

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState('');

  useEffect(() => {
    loadNumbers();
    // Get clientId from session
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((s) => setClientId(s?.user?.clientId || ''));
  }, []);

  async function loadNumbers() {
    const res = await fetch('/api/client/numbers');
    const data = await res.json();
    setNumbers(data);
  }

  async function addNumber() {
    if (!newPhone.trim()) return;
    setLoading(true);
    const res = await fetch('/api/client/numbers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: newPhone.trim() }),
    });
    if (res.ok) {
      const num = await res.json();
      setNumbers((prev) => [num, ...prev]);
      setNewPhone('');
    }
    setLoading(false);
  }

  async function deleteNumber(id: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את המספר?')) return;
    const res = await fetch(`/api/client/numbers?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setNumbers((prev) => prev.filter((n) => n.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">מספרים מחוברים</h1>
        <p className="text-gray-500 mt-1">נהל את מספרי ה-WhatsApp שלך</p>
      </div>

      {/* Add Number */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">הוסף מספר חדש</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="מספר טלפון (ללא +, למשל: 972501234567)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              dir="ltr"
              className="max-w-xs"
            />
            <Button onClick={addNumber} disabled={loading} className="gap-2">
              <Plus className="w-4 h-4" />
              {loading ? 'מחבר...' : 'הוסף מספר'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            לאחר הוספה, יוצג קוד QR לסריקה עם WhatsApp
          </p>
        </CardContent>
      </Card>

      {/* Numbers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {numbers.map((num) => {
          const statusInfo = STATUS_LABELS[num.status] || { label: num.status, variant: 'secondary' as const };
          return (
            <Card key={num.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900" dir="ltr">
                        +{num.phoneNumber}
                      </p>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteNumber(num.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* QR Code display */}
                {clientId && (
                  <QRCodeDisplay
                    clientId={clientId}
                    numberId={num.id}
                    initialStatus={num.status}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}

        {numbers.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>אין מספרים מחוברים. הוסף את המספר הראשון שלך.</p>
          </div>
        )}
      </div>
    </div>
  );
}
