'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, MessageSquare, Smartphone } from 'lucide-react';
import { io } from 'socket.io-client';

interface ConnectData {
  numberId: string;
  clientId: string;
  phoneNumber: string;
  status: string;
  clientName: string;
  branding: { primaryColor?: string; logoUrl?: string; brandName?: string } | null;
}

export default function RemoteConnectPage() {
  const { token } = useParams();
  const [data, setData] = useState<ConnectData | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);
  const [mode, setMode] = useState<'qr' | 'code'>('qr');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/connect/${token}`)
      .then((r) => {
        if (!r.ok) { setExpired(true); return null; }
        return r.json();
      })
      .then((d: ConnectData | null) => {
        if (!d) return;
        setData(d);
        setLoading(false);

        if (d.status === 'ONLINE') { setConnected(true); return; }

        // Connect to Socket.IO
        const sock = io({ path: '/socket.io', query: { clientId: d.clientId } });

        sock.on('qr', ({ numberId, qr: qrData }: { numberId: string; qr: string }) => {
          if (numberId === d.numberId) setQr(qrData);
        });

        sock.on('number:status', ({ numberId, status }: { numberId: string; status: string }) => {
          if (numberId === d.numberId && status === 'ONLINE') {
            setConnected(true);
            setQr(null);
            sock.disconnect();
          }
        });

        // Start session
        fetch('/api/client/numbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: d.phoneNumber }),
        });

        return () => sock.disconnect();
      });
  }, [token]);

  async function requestPairingCode() {
    if (!data) return;
    setMode('code');
    const res = await fetch('/api/client/numbers/pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: data.phoneNumber }),
    });
    const json = await res.json();
    setPairingCode(json.pairingCode);
  }

  const brandName = data?.branding?.brandName || data?.clientName || 'שלמה פופוביץ';
  const primaryColor = data?.branding?.primaryColor || '#25D366';

  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">קישור לא תקף</h1>
          <p className="text-gray-500 mt-2">קישור זה פג תוקף או שגוי. בקש קישור חדש.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{brandName}</h1>
          <p className="text-sm text-gray-500 mt-1">חיבור מספר WhatsApp</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          {connected ? (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-900">מחובר בהצלחה! ✅</h2>
              <p className="text-gray-500 text-sm mt-2">המספר שלך חובר למערכת.</p>
            </div>
          ) : (
            <>
              <div className="flex rounded-xl bg-gray-100 p-1 mb-6 gap-1">
                <button
                  onClick={() => setMode('qr')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'qr' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                  }`}
                >
                  📷 QR Code
                </button>
                <button
                  onClick={requestPairingCode}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'code' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                  }`}
                >
                  📱 קוד חיבור
                </button>
              </div>

              {mode === 'qr' && (
                <div className="text-center">
                  {qr ? (
                    <>
                      <div className="border-4 border-green-400 rounded-xl p-2 inline-block">
                        <img src={qr} alt="QR Code" width={200} height={200} className="rounded-lg" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        פתח WhatsApp → הגדרות → מכשירים מקושרים → קשר מכשיר
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                      <p className="text-sm text-muted-foreground">מייצר קוד QR...</p>
                    </div>
                  )}
                </div>
              )}

              {mode === 'code' && (
                <div className="text-center">
                  {pairingCode ? (
                    <>
                      <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-200">
                        <p className="text-xs text-muted-foreground mb-2">קוד החיבור שלך</p>
                        <p className="text-4xl font-mono font-bold text-gray-900 tracking-widest">
                          {pairingCode}
                        </p>
                        <p className="text-xs text-red-500 mt-2">תקף ל-5 דקות</p>
                      </div>
                      <div className="mt-4 text-right space-y-1">
                        <p className="text-sm font-semibold text-gray-700">הוראות:</p>
                        <p className="text-xs text-muted-foreground">1. פתח WhatsApp → הגדרות</p>
                        <p className="text-xs text-muted-foreground">2. לחץ על "מכשירים מקושרים"</p>
                        <p className="text-xs text-muted-foreground">3. לחץ "קשר מכשיר"</p>
                        <p className="text-xs text-muted-foreground">4. הזן את הקוד שלמעלה</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                      <p className="text-sm text-muted-foreground">יוצר קוד חיבור...</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
