import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '@/lib/redis';
import { BroadcastWorker, BroadcastJobData } from './BroadcastWorker';

const CONNECTION = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
  port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
};

export class QueueManager {
  private static instance: QueueManager;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  private getQueueName(numberId: string): string {
    return `broadcast:${numberId}`;
  }

  getQueue(numberId: string): Queue {
    if (!this.queues.has(numberId)) {
      const queue = new Queue(this.getQueueName(numberId), {
        connection: CONNECTION,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      });
      this.queues.set(numberId, queue);
    }
    return this.queues.get(numberId)!;
  }

  async enqueueBroadcast(data: {
    clientId: string;
    sendingNumberId: string;
    msg: Parameters<typeof BroadcastWorker.prototype.process>[0]['data']['msg'];
    campaign: {
      id: string;
      targets: { groupJid: string; numberId: string | null }[];
      textSuffix: string | null;
      mediaSuffix: string | null;
    };
  }): Promise<void> {
    const { clientId, sendingNumberId, msg, campaign } = data;

    // Get all online numbers for load balancing
    const { SessionManager } = await import('../whatsapp/SessionManager');
    const sm = SessionManager.getInstance();
    const onlineNumberIds = sm.getOnlineNumbersForClient(clientId);

    if (onlineNumberIds.length === 0) {
      console.warn(`No online numbers for client ${clientId}`);
      return;
    }

    // Load balancing: distribute targets across online numbers
    const targets = campaign.targets;
    const batchSize = Math.ceil(targets.length / onlineNumberIds.length);

    for (let i = 0; i < onlineNumberIds.length; i++) {
      const batch = targets.slice(i * batchSize, (i + 1) * batchSize);
      if (batch.length === 0) break;

      const numberId = onlineNumberIds[i];
      const queue = this.getQueue(numberId);

      for (const target of batch) {
        const jobData: BroadcastJobData = {
          clientId,
          numberId,
          targetGroupJid: target.groupJid,
          sourceMsgId: msg.key.id!,
          sourceGroupJid: msg.key.remoteJid!,
          msgContent: JSON.stringify(msg),
          textSuffix: campaign.textSuffix,
          mediaSuffix: campaign.mediaSuffix,
          campaignId: campaign.id,
        };

        await queue.add('broadcast', jobData, {
          jobId: `${campaign.id}:${target.groupJid}:${msg.key.id}`,
        });
      }

      // Start worker for this number if not already running
      this.ensureWorker(numberId);
    }
  }

  ensureWorker(numberId: string): void {
    if (!this.workers.has(numberId)) {
      const worker = new BroadcastWorker(numberId, CONNECTION);
      this.workers.set(numberId, worker.getWorker());
    }
  }

  async startAllWorkers(): Promise<void> {
    // Workers are started on-demand; this restores paused queues
    const { prisma } = await import('@/lib/prisma');
    const numbers = await prisma.connectedNumber.findMany({
      where: { status: 'ONLINE' },
      select: { id: true },
    });

    for (const n of numbers) {
      this.ensureWorker(n.id);
    }
  }

  async pauseQueue(numberId: string): Promise<void> {
    const queue = this.getQueue(numberId);
    await queue.pause();
    console.log(`⏸️  Queue paused for number ${numberId}`);
  }

  async resumeQueue(numberId: string): Promise<void> {
    const queue = this.getQueue(numberId);
    await queue.resume();
    console.log(`▶️  Queue resumed for number ${numberId}`);
  }

  async getQueueStats(numberId: string) {
    const queue = this.getQueue(numberId);
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  async closeAll(): Promise<void> {
    for (const [, worker] of this.workers) {
      await worker.close();
    }
    for (const [, queue] of this.queues) {
      await queue.close();
    }
    this.workers.clear();
    this.queues.clear();
  }
}
