import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await prisma.superAdminSettings.findFirst();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הגדרות מערכת</h1>
        <p className="text-gray-500 mt-1">הגדרות גלובליות עבור כל המערכת</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            הגדרות כלליות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">מילות חסימה</p>
              <p className="text-sm text-muted-foreground">
                {settings?.blockedKeywords?.length
                  ? settings.blockedKeywords.join(', ')
                  : 'אין מילות חסימה מוגדרות'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">מצב מערכת</p>
              <p className="text-sm">
                {settings?.globalPaused ? (
                  <span className="text-red-600 font-semibold">⏸️ מושהית</span>
                ) : (
                  <span className="text-green-600 font-semibold">✅ פעילה</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
