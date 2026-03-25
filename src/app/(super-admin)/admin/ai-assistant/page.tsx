'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, User, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  'הצג רשימת כל הלקוחות',
  'השהה את המערכת כולה',
  'אפס מכסה יומית ללקוח',
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'שלום! אני עוזר הניהול החכם שלך 🤖\nאני יכול לעזור לך לנהל לקוחות, לעדכן הגדרות ולבצע פעולות מערכת בטוחות.\nמה תרצה לעשות?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch('/api/admin/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: allMessages }),
    });

    const json = await res.json();
    setMessages((prev) => [...prev, { role: 'assistant', content: json.reply || 'שגיאה בתגובה' }]);
    setLoading(false);
  }

  return (
    <div className="space-y-4 h-[calc(100vh-120px)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-purple-600" />
          עוזר ניהול AI
        </h1>
        <p className="text-gray-500 mt-1">ניהול מערכת בשפה טבעית — בטוח ומבוקר</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => sendMessage(action)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium hover:bg-purple-100 transition-colors"
          >
            <Zap className="w-3 h-3" />
            {action}
          </button>
        ))}
      </div>

      {/* Chat */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'assistant' ? 'bg-purple-100' : 'bg-blue-100'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <Bot className="w-4 h-4 text-purple-600" />
                ) : (
                  <User className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'assistant'
                    ? 'bg-gray-100 text-gray-900 rounded-tr-none'
                    : 'bg-blue-600 text-white rounded-tl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-600" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-tr-none px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>

        {/* Input */}
        <div className="border-t p-4 flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder='למשל: "השהה לקוח X כי לא שילם"'
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Send className="w-4 h-4" />
            שלח
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ העוזר מבצע פעולות אמיתיות. בדוק את הבקשות לפני שליחה.
      </p>
    </div>
  );
}
