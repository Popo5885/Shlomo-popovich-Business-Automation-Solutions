'use client';

import Link from 'next/link';
import { Smartphone, Users2, Group, Megaphone, CheckCircle, ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  done: boolean;
  emoji: string;
}

interface OnboardingChecklistProps {
  hasNumbers: boolean;
  hasSenders: boolean;
  hasGroups: boolean;
  hasCampaigns: boolean;
}

export function OnboardingChecklist({
  hasNumbers,
  hasSenders,
  hasGroups,
  hasCampaigns,
}: OnboardingChecklistProps) {
  const completedCount = [hasNumbers, hasSenders, hasGroups, hasCampaigns].filter(Boolean).length;
  const allDone = completedCount === 4;

  if (allDone) return null;

  const items: ChecklistItem[] = [
    {
      id: 'numbers',
      title: 'חבר מספר WhatsApp',
      description: 'בחירה בין סריקת QR Code לקוד חיבור מהיר',
      href: '/dashboard/numbers',
      icon: Smartphone,
      done: hasNumbers,
      emoji: '📱',
    },
    {
      id: 'senders',
      title: 'הוסף שולח מורשה',
      description: 'הגדר מי רשאי להפעיל שידורים מהקבוצות',
      href: '/dashboard/senders',
      icon: Users2,
      done: hasSenders,
      emoji: '👤',
    },
    {
      id: 'groups',
      title: 'סנכרן קבוצות WhatsApp',
      description: 'ייבא את הקבוצות שלך ממספר מחובר',
      href: '/dashboard/groups',
      icon: Group,
      done: hasGroups,
      emoji: '👥',
    },
    {
      id: 'campaigns',
      title: 'צור קמפיין שידור',
      description: 'הגדר מקור יעד ואוטומטיזציה',
      href: '/dashboard/campaigns',
      icon: Megaphone,
      done: hasCampaigns,
      emoji: '📢',
    },
  ];

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>🚀 התחל עם המערכת</span>
          <span className="text-sm font-normal text-green-600 bg-green-100 px-3 py-1 rounded-full">
            {completedCount}/4 הושלם
          </span>
        </CardTitle>
        <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / 4) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.done ? '#' : item.href}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                item.done
                  ? 'border-green-100 bg-green-50 opacity-60 cursor-default'
                  : 'border-gray-100 bg-white hover:border-green-300 hover:shadow-sm cursor-pointer'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                  item.done ? 'bg-green-100' : 'bg-gray-50'
                }`}
              >
                {item.done ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  item.emoji
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${
                    item.done ? 'line-through text-gray-400' : 'text-gray-900'
                  }`}
                >
                  {item.title}
                </p>
                {!item.done && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
              </div>
              {!item.done && (
                <ChevronLeft className="w-4 h-4 text-gray-300 rtl-flip shrink-0" />
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
