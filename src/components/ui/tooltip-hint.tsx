import { HelpCircle } from 'lucide-react';

interface TooltipHintProps {
  text: string;
  example?: string;
}

export function TooltipHint({ text, example }: TooltipHintProps) {
  return (
    <div className="flex items-start gap-1.5 mt-1.5">
      <HelpCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground leading-snug">{text}</p>
        {example && (
          <p className="text-xs text-blue-500 mt-0.5 font-medium">
            💡 {example}
          </p>
        )}
      </div>
    </div>
  );
}
