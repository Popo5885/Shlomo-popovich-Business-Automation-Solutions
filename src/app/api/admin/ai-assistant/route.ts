import { NextRequest, NextResponse } from 'next/server';
import { auth, isSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { QueueManager } from '@/server/queue/QueueManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Safe system tools the AI can call ─────────────────────────────────────────

const SYSTEM_TOOLS: Anthropic.Tool[] = [
  {
    name: 'suspendClient',
    description: 'Suspend a client account. Stops all active queues immediately. Use when client has not paid.',
    input_schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The client ID to suspend' },
        reason: { type: 'string', description: 'Reason for suspension' },
      },
      required: ['clientId', 'reason'],
    },
  },
  {
    name: 'activateClient',
    description: 'Reactivate a suspended client account.',
    input_schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The client ID to reactivate' },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'getUserStats',
    description: 'Get detailed statistics for a specific client.',
    input_schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The client ID' },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'resetClientLimits',
    description: 'Reset a client daily usage counter to zero.',
    input_schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The client ID' },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'updateSystemDelay',
    description: 'Update the default message delay range for a client (anti-ban protection).',
    input_schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'The client ID' },
        minDelay: { type: 'number', description: 'Minimum delay in seconds' },
        maxDelay: { type: 'number', description: 'Maximum delay in seconds' },
      },
      required: ['clientId', 'minDelay', 'maxDelay'],
    },
  },
  {
    name: 'listAllClients',
    description: 'Get a list of all clients with their status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'toggleGlobalPause',
    description: 'Pause or resume the entire system for all clients.',
    input_schema: {
      type: 'object',
      properties: {
        paused: { type: 'boolean', description: 'true to pause, false to resume' },
      },
      required: ['paused'],
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'suspendClient': {
      const { clientId, reason } = input as { clientId: string; reason: string };
      await prisma.client.update({
        where: { id: clientId },
        data: { isActive: false, subscriptionStatus: 'SUSPENDED' },
      });
      const numbers = await prisma.connectedNumber.findMany({
        where: { clientId },
        select: { id: true },
      });
      const qm = QueueManager.getInstance();
      await Promise.all(numbers.map((n) => qm.pauseQueue(n.id)));
      await prisma.activityLog.create({
        data: { clientId, actor: 'ai-assistant', action: 'client.suspended', details: { reason } },
      });
      return `✅ לקוח ${clientId} הושהה בהצלחה. ${numbers.length} תורים עצרו.`;
    }

    case 'activateClient': {
      const { clientId } = input as { clientId: string };
      await prisma.client.update({
        where: { id: clientId },
        data: { isActive: true, subscriptionStatus: 'ACTIVE' },
      });
      return `✅ לקוח ${clientId} הופעל מחדש.`;
    }

    case 'getUserStats': {
      const { clientId } = input as { clientId: string };
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          name: true, email: true, subscriptionStatus: true,
          dailyUsage: true, dailyLimit: true,
          monthlyUsage: true, monthlyLimit: true,
          _count: { select: { sessions: true, campaigns: true, groups: true } },
        },
      });
      if (!client) return '❌ לקוח לא נמצא';
      return JSON.stringify(client, null, 2);
    }

    case 'resetClientLimits': {
      const { clientId } = input as { clientId: string };
      await prisma.client.update({
        where: { id: clientId },
        data: { dailyUsage: 0 },
      });
      return `✅ מכסת השימוש היומי של לקוח ${clientId} אופסה.`;
    }

    case 'updateSystemDelay': {
      const { clientId, minDelay, maxDelay } = input as {
        clientId: string;
        minDelay: number;
        maxDelay: number;
      };
      await prisma.client.update({
        where: { id: clientId },
        data: { minDelaySec: minDelay, maxDelaySec: maxDelay },
      });
      return `✅ עיכוב עדכן ל-${minDelay}-${maxDelay} שניות עבור לקוח ${clientId}.`;
    }

    case 'listAllClients': {
      const clients = await prisma.client.findMany({
        where: { email: { not: process.env.SUPER_ADMIN_EMAIL } },
        select: { id: true, name: true, email: true, subscriptionStatus: true, isActive: true },
      });
      return JSON.stringify(clients, null, 2);
    }

    case 'toggleGlobalPause': {
      const { paused } = input as { paused: boolean };
      await prisma.superAdminSettings.updateMany({ data: { globalPaused: paused } });
      return `✅ המערכת ${paused ? 'הושהתה' : 'הופעלה מחדש'} לכל הלקוחות.`;
    }

    default:
      return `❌ פונקציה לא ידועה: ${name}`;
  }
}

// ── Main API handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { messages } = body as { messages: Anthropic.MessageParam[] };

  const systemPrompt = `אתה עוזר ניהול מערכת חכם עבור פלטפורמת "שלמה פופוביץ שירותי אוטומציות לעסקים".
אתה יכול לבצע פעולות מערכת בטוחות באמצעות הכלים הזמינים לך.
דבר תמיד בעברית. היה ברור וממוקד.
לפני ביצוע פעולות רגישות (השהיה, מחיקה), וודא שהבנת את הבקשה נכון.
אל תבצע פעולות שאינן בתחום הכלים המוגדרים. אל תשנה קוד מקור.`;

  try {
    let currentMessages = [...messages];

    // Agentic loop — handle tool calls
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: SYSTEM_TOOLS,
        messages: currentMessages,
      });

      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find((c) => c.type === 'text');
        const aiText = textContent?.type === 'text' ? textContent.text : '';

        // Log the interaction
        await prisma.aiActionLog.create({
          data: {
            adminEmail: session.user.email || 'admin',
            userMessage: messages[messages.length - 1]?.content as string || '',
            aiResponse: aiText,
          },
        });

        return NextResponse.json({ reply: aiText, toolCalls: [] });
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((c) => c.type === 'tool_use');
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.type !== 'tool_use') continue;
          const result = await executeTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }

        // Add assistant message + tool results
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        ];
      }
    }

    return NextResponse.json({ reply: 'לא הצלחתי לעבד את הבקשה.' });
  } catch (err) {
    console.error('AI Assistant error:', err);
    return NextResponse.json({ error: 'שגיאת מערכת' }, { status: 500 });
  }
}
