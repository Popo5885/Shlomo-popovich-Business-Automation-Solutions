import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { SessionManager } from '../whatsapp/SessionManager';
import { BroadcastSender } from '../whatsapp/BroadcastSender';
import { emitCampaignProgress } from '@/lib/socket';
import { sleep, randomDelay } from '@/lib/utils';
import { WAMessage } from '@whiskeysockets/baileys';

export interface BroadcastJobData {
  clientId: string;
  numberId: string;
  targetGroupJid: string;
  sourceMsgId: string;
  sourceGroupJid: string;
  msgContent: string; // JSON stringified WAMessage
  textSuffix?: string | null;
  mediaSuffix?: string | null;
  campaignId: string;
}

export class BroadcastWorker {
  private worker: Worker<BroadcastJobData>;

  constructor(
    numberId: string,
    connection: { host: string; port: number },
  ) {
    this.worker = new Worker<BroadcastJobData>(
      `broadcast:${numberId}`,
      async (job: Job<BroadcastJobData>) => this.process(job),
      {
        connection,
        concurrency: 1, // Process one message at a time per number
        limiter: {
          max: 5,
          duration: 60000, // Max 5 messages per minute per number
        },
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ Broadcast job completed: ${job.id}`);
    });

    this.worker.on('failed', async (job, err) => {
      console.error(`❌ Broadcast job failed: ${job?.id}`, err?.message);

      // Check for WhatsApp ban/disconnect errors
      if (err?.message?.includes('401') || err?.message?.includes('403') || err?.message?.includes('Stream Errored')) {
        console.warn(`🚨 Detected ban/disconnect for number ${numberId}, pausing queue`);
        const { QueueManager } = await import('./QueueManager');
        const qm = QueueManager.getInstance();
        await qm.pauseQueue(numberId);

        // Update number status
        const number = await prisma.connectedNumber.findUnique({
          where: { id: numberId },
        });
        if (number) {
          await prisma.connectedNumber.update({
            where: { id: numberId },
            data: { status: 'PAUSED' },
          });
          const { emitDisconnect } = await import('@/lib/socket');
          emitDisconnect(number.clientId, numberId, number.phoneNumber);
        }
      }
    });
  }

  async process(job: Job<BroadcastJobData>): Promise<void> {
    const {
      clientId,
      numberId,
      targetGroupJid,
      sourceMsgId,
      sourceGroupJid,
      msgContent,
      textSuffix,
      mediaSuffix,
      campaignId,
    } = job.data;

    // Get the socket for this number
    const sm = SessionManager.getInstance();
    const sock = sm.getSocket(clientId, numberId);

    if (!sock) {
      throw new Error(`No active socket for number ${numberId}`);
    }

    // Parse the original message
    const msg = JSON.parse(msgContent) as WAMessage;

    // Restore Date objects in message (JSON.parse drops them)
    const sender = new BroadcastSender(sock);

    await sender.send({
      clientId,
      targetGroupJid,
      msg,
      textSuffix,
      mediaSuffix,
      sourceMsgId,
      sourceGroupJid,
    });

    // Get campaign stats for progress reporting
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { _count: { select: { targets: true } } },
    });

    if (campaign) {
      const totalSent = await prisma.messageMapping.count({
        where: { clientId, sourceMsgId },
      });
      emitCampaignProgress(clientId, campaignId, totalSent, campaign._count.targets, 0);
    }

    // Randomized delay between messages (anti-ban)
    const delayConfig = await getCampaignDelays(campaignId);
    const delayMs = randomDelay(delayConfig.min, delayConfig.max);
    console.log(`⏳ Waiting ${delayMs / 1000}s before next message...`);
    await sleep(delayMs);
  }

  getWorker(): Worker<BroadcastJobData> {
    return this.worker;
  }
}

async function getCampaignDelays(campaignId: string): Promise<{ min: number; max: number }> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { minDelay: true, maxDelay: true },
    });
    return { min: campaign?.minDelay || 3, max: campaign?.maxDelay || 10 };
  } catch {
    return { min: 3, max: 10 };
  }
}
