'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Image from 'next/image';
import { Loader2, CheckCircle, XCircle, WifiOff } from 'lucide-react';

interface QRCodeDisplayProps {
  clientId: string;
  numberId: string;
  initialStatus: 'ONLINE' | 'OFFLINE' | 'PAUSED' | 'BANNED';
}

export function QRCodeDisplay({ clientId, numberId, initialStatus }: QRCodeDisplayProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(initialStatus === 'OFFLINE');

  useEffect(() => {
    const sock = io({ path: '/socket.io', query: { clientId } });

    sock.on('qr', (data: { numberId: string; qr: string }) => {
      if (data.numberId === numberId) {
        setQr(data.qr);
        setLoading(false);
      }
    });

    sock.on('number:status', (data: { numberId: string; status: string }) => {
      if (data.numberId === numberId) {
        setStatus(data.status as typeof status);
        if (data.status === 'ONLINE') {
          setQr(null);
          setLoading(false);
        }
      }
    });

    return () => {
      sock.disconnect();
    };
  }, [clientId, numberId]);

  if (status === 'ONLINE') {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="w-5 h-5" />
        <span className="text-sm font-medium">מחובר</span>
      </div>
    );
  }

  if (status === 'BANNED') {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <XCircle className="w-5 h-5" />
        <span className="text-sm font-medium">חסום / נותק</span>
      </div>
    );
  }

  if (status === 'PAUSED') {
    return (
      <div className="flex items-center gap-2 text-yellow-600">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm font-medium">מושהה - יש לחבר מחדש</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        <p className="text-sm text-muted-foreground">ממתין לקוד QR...</p>
      </div>
    );
  }

  if (qr) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="border-4 border-green-500 rounded-xl p-2 shadow-lg">
          <img src={qr} alt="QR Code" width={200} height={200} className="rounded-lg" />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          סרוק קוד QR זה עם WhatsApp שלך
        </p>
      </div>
    );
  }

  return null;
}
