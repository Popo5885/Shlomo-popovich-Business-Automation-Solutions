'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Pencil, Play, Pause, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Campaign {
  id: string;
  name: string;
  sourceGroupJid: string;
  triggerType: 'DIRECT' | 'LISTENER';
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  textSuffix: string | null;
  mediaSuffix: string | null;
  requireApproval: boolean;
  minDelay: number;
  maxDelay: number;
  targets: { id: string; groupJid: string }[];
}

interface GroupItem {
  id: string;
  jid: string;
  name: string;
}

const STATUS_LABELS = {
  ACTIVE: { label: 'פעיל', variant: 'success' as const },
  PAUSED: { label: 'מושהה', variant: 'warning' as const },
  STOPPED: { label: 'עצור', variant: 'secondary' as const },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sourceGroupJid: '',
    triggerType: 'LISTENER' as 'DIRECT' | 'LISTENER',
    textSuffix: '',
    mediaSuffix: '',
    requireApproval: true,
    minDelay: 3,
    maxDelay: 10,
    targetJids: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [campaignsRes, groupsRes] = await Promise.all([
      fetch('/api/client/campaigns'),
      fetch('/api/client/groups'),
    ]);
    setCampaigns(await campaignsRes.json());
    setGroups(await groupsRes.json());
  }

  async function saveCampaign() {
    setLoading(true);
    const payload = {
      ...form,
      textSuffix: form.textSuffix || null,
      mediaSuffix: form.mediaSuffix || null,
    };

    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...payload } : payload;

    await fetch('/api/client/campaigns', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    resetForm();
    await loadData();
    setLoading(false);
  }

  async function deleteCampaign(id: string) {
    if (!confirm('מחק קמפיין זה?')) return;
    await fetch(`/api/client/campaigns?id=${id}`, { method: 'DELETE' });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  function resetForm() {
    setForm({
      name: '',
      sourceGroupJid: '',
      triggerType: 'LISTENER',
      textSuffix: '',
      mediaSuffix: '',
      requireApproval: true,
      minDelay: 3,
      maxDelay: 10,
      targetJids: [],
    });
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(c: Campaign) {
    setEditId(c.id);
    setForm({
      name: c.name,
      sourceGroupJid: c.sourceGroupJid,
      triggerType: c.triggerType,
      textSuffix: c.textSuffix || '',
      mediaSuffix: c.mediaSuffix || '',
      requireApproval: c.requireApproval,
      minDelay: c.minDelay,
      maxDelay: c.maxDelay,
      targetJids: c.targets.map((t) => t.groupJid),
    });
    setShowForm(true);
  }

  function toggleTarget(jid: string) {
    setForm((prev) => ({
      ...prev,
      targetJids: prev.targetJids.includes(jid)
        ? prev.targetJids.filter((j) => j !== jid)
        : [...prev.targetJids, jid],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">קמפיינים</h1>
          <p className="text-gray-500 mt-1">הגדר שידורים אוטומטיים מקבוצת מקור לקבוצות יעד</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          קמפיין חדש
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editId ? 'עריכת קמפיין' : 'קמפיין חדש'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>שם הקמפיין</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="קמפיין שידור 1"
                />
              </div>
              <div>
                <Label>קבוצת מקור</Label>
                <select
                  value={form.sourceGroupJid}
                  onChange={(e) => setForm({ ...form, sourceGroupJid: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">בחר קבוצת מקור</option>
                  {groups.map((g) => (
                    <option key={g.jid} value={g.jid}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Targets */}
            <div>
              <Label className="mb-2 block">קבוצות יעד ({form.targetJids.length} נבחרו)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-xl p-3">
                {groups.map((g) => (
                  <label
                    key={g.jid}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                  >
                    <input
                      type="checkbox"
                      checked={form.targetJids.includes(g.jid)}
                      onChange={() => toggleTarget(g.jid)}
                      className="accent-green-600"
                    />
                    <span className="text-sm text-gray-700 truncate">{g.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>סיומת טקסט</Label>
                <Input
                  value={form.textSuffix}
                  onChange={(e) => setForm({ ...form, textSuffix: e.target.value })}
                  placeholder="טקסט שיצורף להודעות טקסט"
                />
              </div>
              <div>
                <Label>סיומת מדיה</Label>
                <Input
                  value={form.mediaSuffix}
                  onChange={(e) => setForm({ ...form, mediaSuffix: e.target.value })}
                  placeholder="כיתוב שיצורף להודעות מדיה"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>השהיה מינימלית (שניות)</Label>
                <Input
                  type="number"
                  value={form.minDelay}
                  onChange={(e) => setForm({ ...form, minDelay: Number(e.target.value) })}
                  min={1}
                />
              </div>
              <div>
                <Label>השהיה מקסימלית (שניות)</Label>
                <Input
                  type="number"
                  value={form.maxDelay}
                  onChange={(e) => setForm({ ...form, maxDelay: Number(e.target.value) })}
                  min={1}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requireApproval}
                  onChange={(e) => setForm({ ...form, requireApproval: e.target.checked })}
                  className="accent-green-600"
                />
                <span className="text-sm">דרוש אישור מנהל לפני שידור</span>
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={saveCampaign}
                disabled={loading || !form.name || !form.sourceGroupJid || form.targetJids.length === 0}
              >
                {loading ? 'שומר...' : editId ? 'עדכן' : 'צור קמפיין'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                ביטול
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((c) => {
          const statusInfo = STATUS_LABELS[c.status] || { label: c.status, variant: 'secondary' as const };
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Megaphone className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{c.name}</p>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCampaign(c.id)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" />
                    <span>{c.targets.length} קבוצות יעד</span>
                  </p>
                  <p>
                    השהיה: {c.minDelay}–{c.maxDelay} שניות
                  </p>
                  {c.requireApproval && (
                    <p className="text-yellow-600">⚠️ דורש אישור מנהל</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {campaigns.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>אין קמפיינים פעילים. צור קמפיין ראשון.</p>
          </div>
        )}
      </div>
    </div>
  );
}
