import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface QuotaBarProps {
  label: string;
  used: number;
  limit: number;
  colorClass?: string;
}

function QuotaBar({ label, used, limit, colorClass }: QuotaBarProps) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-bold',
              isCritical ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600',
            )}
          >
            {percentage}%
          </span>
          <span className="text-xs text-muted-foreground">
            {used.toLocaleString('he-IL')} / {limit.toLocaleString('he-IL')}
          </span>
        </div>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isCritical
              ? 'bg-red-500'
              : isWarning
                ? 'bg-yellow-500'
                : colorClass || 'bg-green-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface QuotaProgressProps {
  dailyUsage: number;
  dailyLimit: number;
  monthlyUsage: number;
  monthlyLimit: number;
}

export function QuotaProgress({
  dailyUsage,
  dailyLimit,
  monthlyUsage,
  monthlyLimit,
}: QuotaProgressProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">מכסת שליחות</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <QuotaBar label="שליחות יומית" used={dailyUsage} limit={dailyLimit} />
        <QuotaBar
          label="שליחות חודשית"
          used={monthlyUsage}
          limit={monthlyLimit}
          colorClass="bg-blue-500"
        />
      </CardContent>
    </Card>
  );
}
