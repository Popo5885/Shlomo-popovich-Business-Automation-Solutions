'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DisconnectedNumber {
  numberId: string;
  phoneNumber: string;
}

interface DisconnectBannerProps {
  clientId: string;
}

export function DisconnectBanner({ clientId }: DisconnectBannerProps) {
  const [disconnected, setDisconnected] = useState<DisconnectedNumber[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const sock = io({ path: '/socket.io', query: { clientId } });
    setSocket(sock);

    sock.on('number:disconnect', ({ numberId, phoneNumber }: DisconnectedNumber) => {
      setDisconnected((prev) => {
        if (prev.some((n) => n.numberId === numberId)) return prev;
        return [...prev, { numberId, phoneNumber }];
      });
    });

    sock.on('number:status', ({ numberId, status }: { numberId: string; status: string }) => {
      if (status === 'ONLINE') {
        setDisconnected((prev) => prev.filter((n) => n.numberId !== numberId));
      }
    });

    return () => {
      sock.disconnect();
    };
  }, [clientId]);

  const dismiss = (numberId: string) => {
    setDisconnected((prev) => prev.filter((n) => n.numberId !== numberId));
  };

  if (disconnected.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {disconnected.map((num) => (
        <div
          key={num.numberId}
          className={cn(
            'flex items-center gap-3 p-4 rounded-xl',
            'bg-red-50 border border-red-200 text-red-800',
            'animate-pulse-red',
          )}
        >
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">
              מספר {num.phoneNumber} התנתק מ-WhatsApp!
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              תור ההודעות הושהה. יש לחבר מחדש את המספר כדי להמשיך שידורים.
            </p>
          </div>
          <a
            href="/dashboard/numbers"
            className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            חבר מחדש
          </a>
          <button
            onClick={() => dismiss(num.numberId)}
            className="p-1 hover:bg-red-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ))}
    </div>
  );
}
