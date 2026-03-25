/**
 * Self-Healing Watchdog
 *
 * Monitors:
 * 1. Connected numbers — auto-reconnects if OFFLINE
 * 2. BullMQ queues — detects stalled jobs and restarts workers
 * 3. Daily counter reset
 * 4. Subscription expiry — auto-suspend expired clients
 */

import { prisma } from '@/lib/prisma';
import { emitNumberStatus } from '@/lib/socket';
import { AntiBanEngine } from './AntiBanEngine';
import { QueueManager } from '../queue/QueueManager';

export class Watchdog {
  private static running = false;
  private static intervals: ReturnType<typeof setInterval>[] = [];

  static start(): void {
    if (Watchdog.running) return;
    Watchdog.running = true;

    console.log('🐕 Watchdog started');

    // Check disconnected numbers every 2 minutes
    Watchdog.intervals.push(
      setInterval(() => Watchdog.checkDisconnectedNumbers(), 2 * 60 * 1000),
    );

    // Reset daily counters at midnight
    Watchdog.intervals.push(
      setInterval(() => Watchdog.maybeResetCounters(), 60 * 1000),
    );

    // Check expired subscriptions every hour
    Watchdog.intervals.push(
      setInterval(() => Watchdog.checkExpiredSubscriptions(), 60 * 60 * 1000),
    );

    // Monitor queue health every 5 minutes
    Watchdog.intervals.push(
      setInterval(() => Watchdog.checkQueueHealth(), 5 * 60 * 1000),
    );

    // Run initial checks
    Watchdog.checkDisconnectedNumbers();
    Watchdog.checkExpiredSubscriptions();
  }

  static stop(): void {
    Watchdog.intervals.forEach(clearInterval);
    Watchdog.intervals = [];
    Watchdog.running = false;
    console.log('🐕 Watchdog stopped');
  }

  private static async checkDisconnectedNumbers(): Promise<void> {
    try {
      // Find numbers that should be online but aren't (OFFLINE for > 5 min)
      const staleNumbers = await prisma.connectedNumber.findMany({
        where: {
          status: 'OFFLINE',
          updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
          client: { isActive: true, subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
        },
        include: { client: { select: { isActive: true } } },
        take: 10,
      });

      for (const number of staleNumbers) {
        if (!number.client.isActive) continue;

        // Check if session file exists for auto-reconnect
        const fs = await import('fs');
        const path = await import('path');
        const sessionPath = path.join(
          process.cwd(),
          'sessions',
          number.clientId,
          number.id,
          'creds.json',
        );

        if (fs.existsSync(sessionPath)) {
          console.log(`🔄 Watchdog: auto-reconnecting ${number.phoneNumber}`);
          const { SessionManager } = await import('./SessionManager');
          const sm = SessionManager.getInstance();
          await sm.startSession(number.clientId, number.id, number.phoneNumber);
        }
      }
    } catch (err) {
      console.error('Watchdog: checkDisconnectedNumbers error:', err);
    }
  }

  private static lastResetDate = '';
  private static async maybeResetCounters(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    if (Watchdog.lastResetDate === today) return;
    Watchdog.lastResetDate = today;

    try {
      await AntiBanEngine.resetDailyCounters();

      // Reset client daily usage
      await prisma.client.updateMany({ data: { dailyUsage: 0 } });
      console.log('✅ Watchdog: daily counters reset');
    } catch (err) {
      console.error('Watchdog: counter reset error:', err);
    }
  }

  private static async checkExpiredSubscriptions(): Promise<void> {
    try {
      const now = new Date();

      // Expire trial accounts past trialEndsAt
      const expiredTrials = await prisma.client.findMany({
        where: {
          subscriptionStatus: 'TRIAL',
          trialEndsAt: { lt: now },
        },
        select: { id: true, name: true, email: true },
      });

      for (const client of expiredTrials) {
        await prisma.client.update({
          where: { id: client.id },
          data: { subscriptionStatus: 'EXPIRED', isActive: false },
        });

        // Stop all queues
        const numbers = await prisma.connectedNumber.findMany({
          where: { clientId: client.id },
          select: { id: true },
        });
        const qm = QueueManager.getInstance();
        await Promise.all(numbers.map((n) => qm.pauseQueue(n.id)));

        console.log(`⚠️ Watchdog: trial expired for ${client.email}`);
      }

      // Also check billing expiry
      const billingExpired = await prisma.client.findMany({
        where: {
          subscriptionStatus: 'ACTIVE',
          nextBillingDate: { lt: now },
        },
        select: { id: true, email: true },
      });

      for (const client of billingExpired) {
        await prisma.client.update({
          where: { id: client.id },
          data: { subscriptionStatus: 'EXPIRED' },
        });
        console.log(`⚠️ Watchdog: billing expired for ${client.email}`);
      }
    } catch (err) {
      console.error('Watchdog: checkExpiredSubscriptions error:', err);
    }
  }

  private static async checkQueueHealth(): Promise<void> {
    try {
      const qm = QueueManager.getInstance();
      const onlineNumbers = await prisma.connectedNumber.findMany({
        where: { status: 'ONLINE' },
        select: { id: true },
      });

      for (const number of onlineNumbers) {
        const stats = await qm.getQueueStats(number.id);
        if (stats.failed > 10) {
          console.warn(
            `⚠️ Watchdog: high failure count (${stats.failed}) for number ${number.id}`,
          );
        }

        // Ensure worker is running
        qm.ensureWorker(number.id);
      }
    } catch (err) {
      console.error('Watchdog: checkQueueHealth error:', err);
    }
  }
}
