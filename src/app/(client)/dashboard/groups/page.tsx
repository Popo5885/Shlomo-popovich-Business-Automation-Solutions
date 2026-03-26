'use client';

import { useEffect, useState } from 'react';
import { Group, Plus, Trash2, Pencil, RefreshCw, Link } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GroupItem {
  id: string;
  jid: string;
  name: string;
  customLink: string | null;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ jid: '', name: '', customLink: '' });
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const res = await fetch('/api/client/groups');
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setGroups([]);
    }
  }

  async function syncGroups() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/client/groups', { method: 'PATCH' });
      const data = await res.json();
      if (data.error) {
        setSyncMsg(`שגיאה: ${data.error}`);
      } else {
        setSyncMsg(data.synced > 0 ? `סונכרנו ${data.synced} קבוצות בהצלחה` : (data.message || 'לא נמצאו קבוצות'));
      }
    } catch {
      setSyncMsg('שגיאה בסנכרון');
    }
    await loadGroups();
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 5000);
  }

  async function saveGroup() {
    setLoading(true);
    if (editId) {
      await fetch('/api/client/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, ...form }),
      });
    } else {
      await fetch('/api/client/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    }
    setForm({ jid: '', name: '', customLink: '' });
    setEditId(null);
    await loadGroups();
    setLoading(false);
  }

  async function deleteGroup(id: string) {
    if (!confirm('מחק קבוצה זו?')) return;
    await fetch(`/api/client/groups?id=${id}`, { method: 'DELETE' });
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function startEdit(g: GroupItem) {
    setEditId(g.id);
    setForm({ jid: g.jid, name: g.name, customLink: g.customLink || '' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קבוצות WhatsApp</h1>
          <p className="text-gray-500 mt-1">נהל קבוצות מקור ויעד לשידורים</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="outline" onClick={syncGroups} disabled={syncing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            סנכרן מ-WhatsApp
          </Button>
          {syncMsg && (
            <p className={`text-xs ${syncMsg.startsWith('שגיאה') ? 'text-red-500' : 'text-green-600'}`}>
              {syncMsg}
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {editId ? 'עריכת קבוצה' : 'הוסף קבוצה ידנית'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>JID קבוצה</Label>
              <Input
                value={form.jid}
                onChange={(e) => setForm({ ...form, jid: e.target.value })}
                placeholder="1234567890@g.us"
                dir="ltr"
              />
            </div>
            <div>
              <Label>שם הקבוצה</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="שם הקבוצה"
              />
            </div>
            <div>
              <Label>קישור מותאם (אופציונלי)</Label>
              <Input
                value={form.customLink}
                onChange={(e) => setForm({ ...form, customLink: e.target.value })}
                placeholder="https://wa.me/..."
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={saveGroup} disabled={loading || !form.jid || !form.name}>
              {loading ? 'שומר...' : editId ? 'עדכן' : 'הוסף'}
            </Button>
            {editId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditId(null);
                  setForm({ jid: '', name: '', customLink: '' });
                }}
              >
                ביטול
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Groups Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">קבוצות ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Group className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>אין קבוצות. סנכרן מ-WhatsApp או הוסף ידנית.</p>
            </div>
          ) : (
            <div className="divide-y">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                      <Group className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{g.name}</p>
                      <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                        {g.jid}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.customLink && (
                      <a
                        href={g.customLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <Link className="w-4 h-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => startEdit(g)}>
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteGroup(g.id)}
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
